import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  segmentNarrationIntoScenes,
  validateScenesIntegrity,
} from "@/features/scenes/scene-segmenter";
import {
  convertCharacterAlignmentToWordSpans,
  MockTTSProvider,
} from "@/lib/providers/tts/tts-provider";
import {
  adjustSceneTimestampsAndText,
  listContentItems,
  listScenesForContent,
  saveVoiceAssetAndSegmentScenes,
} from "@/lib/db/repository";

describe("Milestone 3 — Voice, Timestamp Alignment & Scene Segmentation", () => {
  let tempStorePath: string;
  const ownerId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "co-studio-m3-"));
    tempStorePath = path.join(tmpDir, "studio-store.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(tempStorePath), { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it("segments narration around sentence boundaries without dropping or duplicating any words", () => {
    const narration =
      "Saat kucing terjatuh, sistem keseimbangan di telinga dalamnya langsung mendeteksi arah gravitasi dalam hitungan milidetik. Kucing memutar kepala lebih dulu, lalu tulang belakangnya yang sangat lentur mengikuti putaran kaki depan dan kaki belakang secara bergantian. Uniknya, kucing tidak punya tulang selangka kaku seperti manusia, sehingga tubuhnya bisa berputar seperti pegas kertas lipat di udara sebelum merentangkan kaki untuk meredam benturan.";

    const scenes = segmentNarrationIntoScenes({
      contentId: "content-1",
      contentCode: "CO-2026-001",
      narrationText: narration,
      timestampStatus: "estimated",
      totalAudioDurationMs: 24000,
      minSceneSeconds: 6,
      maxSceneSeconds: 10,
    });

    expect(scenes.length).toBeGreaterThanOrEqual(2);
    expect(scenes[0]?.expectedFilename).toBe("CO-2026-001_SCENE_001.mp4");
    expect(scenes.every((s) => s.timestampStatus === "estimated")).toBe(true);

    const report = validateScenesIntegrity(narration, scenes, 6, 10);
    expect(report.valid).toBe(true);
    expect(report.textCoverageValid).toBe(true);
    expect(report.timestampsOrdered).toBe(true);
    expect(report.noNegativeOrZeroDurations).toBe(true);
  });

  it("rejects tampered scene text or overlapping timestamps during validation", () => {
    const narration = "Kalimat pertama yang singkat. Kalimat kedua yang juga jelas.";
    const scenes = segmentNarrationIntoScenes({
      contentId: "content-1",
      contentCode: "CO-2026-001",
      narrationText: narration,
      timestampStatus: "actual",
      totalAudioDurationMs: 14000,
      minSceneSeconds: 6,
      maxSceneSeconds: 10,
    });

    // Drop a word from scene 1 -> textCoverageValid must be false
    const brokenCoverage = scenes.map((s, idx) =>
      idx === 0 ? { ...s, narrationText: "Kalimat pertama singkat." } : s
    );
    const report1 = validateScenesIntegrity(narration, brokenCoverage);
    expect(report1.valid).toBe(false);
    expect(report1.textCoverageValid).toBe(false);

    // Make end_ms <= start_ms -> noNegativeOrZeroDurations must be false
    const brokenTimestamps = scenes.map((s, idx) =>
      idx === 0 ? { ...s, startMs: 5000, endMs: 4000 } : s
    );
    const report2 = validateScenesIntegrity(narration, brokenTimestamps);
    expect(report2.valid).toBe(false);
    expect(report2.noNegativeOrZeroDurations).toBe(false);
  });

  it("converts ElevenLabs character alignment to actual word spans and persists audio + scenes across sessions", async () => {
    const wordSpans = convertCharacterAlignmentToWordSpans({
      characters: ["H", "a", "l", "o", " ", "O", "b", "i", "m"],
      character_start_times_seconds: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.95],
    });
    expect(wordSpans).toEqual([
      { word: "Halo", startMs: 0, endMs: 400 },
      { word: "Obim", startMs: 500, endMs: 950 },
    ]);

    const items = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    const target = items[0]!;

    const mockTts = new MockTTSProvider();
    const synthesis = await mockTts.synthesize({
      contentId: target.id,
      contentCode: target.contentCode,
      narrationText: target.narration,
    });

    const saved = await saveVoiceAssetAndSegmentScenes(
      ownerId,
      {
        contentId: target.id,
        audioBuffer: synthesis.audioBuffer,
        originalFilename: "CO-2026-001_VOICE.wav",
        mimeType: synthesis.mimeType,
        durationMs: synthesis.durationMs,
        providerKey: synthesis.providerKey,
        providerModel: synthesis.providerModel,
        voiceId: synthesis.voiceId,
        providerRequestId: synthesis.providerRequestId,
        wordSpans: synthesis.wordSpans,
        timestampStatus: synthesis.timestampStatus,
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    expect(saved.voiceAsset.assetType).toBe("voice_audio");
    expect(saved.scenes.length).toBeGreaterThan(0);
    expect(saved.validationReport.valid).toBe(true);

    // Reload from store to verify persistence across sessions
    const reloadedScenes = await listScenesForContent(ownerId, target.id, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(reloadedScenes).toHaveLength(saved.scenes.length);

    // Adjust first scene endMs slightly within valid bounds -> marks manually_adjusted
    const first = reloadedScenes[0]!;
    const adjusted = await adjustSceneTimestampsAndText(
      ownerId,
      {
        contentId: target.id,
        sceneId: first.id,
        startMs: first.startMs,
        endMs: first.endMs + 1000,
        narrationText: first.narrationText,
        visualAction: "Kucing origami melompat indah",
      },
      { storePath: tempStorePath, forceLocal: true }
    );
    expect(adjusted.scenes[0]?.timestampStatus).toBe("manually_adjusted");
    expect(adjusted.scenes[0]?.endMs).toBe(first.endMs + 1000);
    // Adjacent second scene startMs must cascade automatically to avoid overlap
    if (adjusted.scenes.length > 1) {
      expect(adjusted.scenes[1]?.startMs).toBe(adjusted.scenes[0]?.endMs);
    }
  });

  it("preserves durations of all subsequent scenes during ripple timeline shifts", async () => {
    const items = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    const target = items[0]!;

    // Save initial mock scenes: Scene 1 (0-8s), Scene 2 (8-12s, dur 4s), Scene 3 (12-22s, dur 10s), Scene 4 (22-30s, dur 8s)
    const initialScenes = [
      {
        id: "sc-1",
        contentId: target.id,
        sceneIndex: 1,
        expectedFilename: `${target.contentCode}_SCENE_001.mp4`,
        narrationText: "Bagian satu",
        visualAction: "Aksi satu",
        cameraDirection: "Sudut satu",
        startMs: 0,
        endMs: 8000,
        durationMs: 8000,
        durationFlag: "ok" as const,
        timestampStatus: "estimated" as const,
        sceneStatus: "segmented" as const,
        continuityNotes: "",
        promptText: "Prompt 1",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sc-2",
        contentId: target.id,
        sceneIndex: 2,
        expectedFilename: `${target.contentCode}_SCENE_002.mp4`,
        narrationText: "Bagian dua",
        visualAction: "Aksi dua",
        cameraDirection: "Sudut dua",
        startMs: 8000,
        endMs: 12000,
        durationMs: 4000,
        durationFlag: "ok" as const,
        timestampStatus: "estimated" as const,
        sceneStatus: "segmented" as const,
        continuityNotes: "",
        promptText: "Prompt 2",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sc-3",
        contentId: target.id,
        sceneIndex: 3,
        expectedFilename: `${target.contentCode}_SCENE_003.mp4`,
        narrationText: "Bagian tiga",
        visualAction: "Aksi tiga",
        cameraDirection: "Sudut tiga",
        startMs: 12000,
        endMs: 22000,
        durationMs: 10000,
        durationFlag: "ok" as const,
        timestampStatus: "estimated" as const,
        sceneStatus: "segmented" as const,
        continuityNotes: "",
        promptText: "Prompt 3",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "sc-4",
        contentId: target.id,
        sceneIndex: 4,
        expectedFilename: `${target.contentCode}_SCENE_004.mp4`,
        narrationText: "Bagian empat",
        visualAction: "Aksi empat",
        cameraDirection: "Sudut empat",
        startMs: 22000,
        endMs: 30000,
        durationMs: 8000,
        durationFlag: "ok" as const,
        timestampStatus: "estimated" as const,
        sceneStatus: "segmented" as const,
        continuityNotes: "",
        promptText: "Prompt 4",
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const { saveScenesForContent } = await import("@/lib/db/repository");
    await saveScenesForContent(ownerId, target.id, initialScenes, {
      storePath: tempStorePath,
      forceLocal: true,
    });

    // Case 1: Adjust Scene 2 endMs from 12000 to 16000
    const res1 = await adjustSceneTimestampsAndText(
      ownerId,
      {
        contentId: target.id,
        sceneId: "sc-2",
        startMs: 8000,
        endMs: 16000,
        narrationText: "Bagian dua",
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    const s1 = res1.scenes.find((s) => s.sceneIndex === 1)!;
    const s2 = res1.scenes.find((s) => s.sceneIndex === 2)!;
    const s3 = res1.scenes.find((s) => s.sceneIndex === 3)!;
    const s4 = res1.scenes.find((s) => s.sceneIndex === 4)!;

    expect(s1.startMs).toBe(0);
    expect(s1.endMs).toBe(8000);

    expect(s2.startMs).toBe(8000);
    expect(s2.endMs).toBe(16000);
    expect(s2.durationMs).toBe(8000);

    // Scene 3 must start at Scene 2's end (16000) and preserve its 10000ms duration -> ends at 26000
    expect(s3.startMs).toBe(16000);
    expect(s3.durationMs).toBe(10000);
    expect(s3.endMs).toBe(26000);

    // Scene 4 must start at Scene 3's end (26000) and preserve its 8000ms duration -> ends at 34000
    expect(s4.startMs).toBe(26000);
    expect(s4.durationMs).toBe(8000);
    expect(s4.endMs).toBe(34000);

    // Case 2: Extend Scene 2 further from 16000 to 18000
    const res2 = await adjustSceneTimestampsAndText(
      ownerId,
      {
        contentId: target.id,
        sceneId: "sc-2",
        startMs: 8000,
        endMs: 18000,
        narrationText: "Bagian dua",
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    const s2b = res2.scenes.find((s) => s.sceneIndex === 2)!;
    const s3b = res2.scenes.find((s) => s.sceneIndex === 3)!;
    const s4b = res2.scenes.find((s) => s.sceneIndex === 4)!;

    expect(s2b.startMs).toBe(8000);
    expect(s2b.endMs).toBe(18000);
    expect(s2b.durationMs).toBe(10000);

    // Scene 3 shifts to start at 18000 and ends at 28000 (dur: 10000)
    expect(s3b.startMs).toBe(18000);
    expect(s3b.durationMs).toBe(10000);
    expect(s3b.endMs).toBe(28000);

    // Scene 4 shifts to start at 28000 and ends at 36000 (dur: 8000)
    expect(s4b.startMs).toBe(28000);
    expect(s4b.durationMs).toBe(8000);
    expect(s4b.endMs).toBe(36000);
  });
});
