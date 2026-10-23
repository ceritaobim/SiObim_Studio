import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  exportPromptPackAsCsv,
  exportPromptPackAsTxt,
  exportPromptPackAsXlsxBuffer,
} from "@/features/scenes/prompt-generator";
import {
  evaluateClipCompleteness,
  matchFilenameToScene,
} from "@/features/video-generation/clip-matcher";
import {
  generateAndSaveScenePrompts,
  listAssetsForContent,
  listContentItems,
  saveUploadedSceneClip,
} from "@/lib/db/repository";

describe("Milestone 4 — Scene Prompts & Semi-Manual Google Flow", () => {
  let tempStorePath: string;
  const ownerId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "co-studio-m4-"));
    tempStorePath = path.join(tmpDir, "studio-store.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(tempStorePath), { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it("generates origami stop-motion prompts with continuity and exports TXT, CSV, and XLSX prompt packs", async () => {
    const items = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    const content = items[0]!;

    const scenes = await generateAndSaveScenePrompts(ownerId, content.id, {
      storePath: tempStorePath,
      forceLocal: true,
    });

    expect(scenes.length).toBeGreaterThanOrEqual(2);
    expect(scenes[0]?.expectedFilename).toBe("CO-2026-001_SCENE_001.mp4");
    expect(scenes[0]?.promptText).toContain("origami");
    expect(scenes[0]?.promptText).toContain("NO subtitles");
    expect(scenes[1]?.promptText).toContain("CONTINUITY FROM SCENE #1");

    const txt = exportPromptPackAsTxt(content, scenes);
    expect(txt).toContain("CO-2026-001_SCENE_001.mp4");
    expect(txt).toContain("Semi-Manual Google Flow");

    const csv = exportPromptPackAsCsv(content, scenes);
    expect(csv).toContain("Expected Filename");
    expect(csv).toContain("CO-2026-001_SCENE_001.mp4");

    const xlsxBuf = exportPromptPackAsXlsxBuffer(content, scenes);
    expect(xlsxBuf.byteLength).toBeGreaterThan(100);
  });

  it("matches clip filenames to scenes and detects missing and duplicate scene clips", async () => {
    const items = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    const content = items[0]!;
    const scenes = await generateAndSaveScenePrompts(ownerId, content.id, {
      storePath: tempStorePath,
      forceLocal: true,
    });

    // Test filename matching patterns
    const matchExact = matchFilenameToScene(
      "CO-2026-001_SCENE_001.mp4",
      scenes
    );
    expect(matchExact.matchedSceneIndex).toBe(1);

    const matchLoose = matchFilenameToScene("flow_output_scene_2.mp4", scenes);
    expect(matchLoose.matchedSceneIndex).toBe(2);

    const matchBagian = matchFilenameToScene("Bagian 3.mp4", scenes);
    expect(matchBagian.matchedSceneIndex).toBe(3);

    const matchPart = matchFilenameToScene("Part_4.mp4", scenes);
    expect(matchPart.matchedSceneIndex).toBe(4);

    const matchParen = matchFilenameToScene("download (5).mp4", scenes);
    expect(matchParen.matchedSceneIndex).toBe(5);

    // Batch mapping with arbitrary filenames from Gemini/Flow
    const { matchBatchFilesToScenes } = await import(
      "@/features/video-generation/clip-matcher"
    );
    const batchCandidates = matchBatchFilesToScenes(
      [
        { name: "Boy_pulls_origami_lever_2026.mp4", lastModified: 1000 },
        { name: "Origami_clock_turning_2026.mp4", lastModified: 2000 },
      ],
      scenes
    );
    expect(batchCandidates[0]?.matchedSceneIndex).toBe(1);
    expect(batchCandidates[1]?.matchedSceneIndex).toBe(2);

    // Before any uploads, all scenes are missing
    const initialCheck = evaluateClipCompleteness(scenes, []);
    expect(initialCheck.readyForAssembly).toBe(false);
    expect(initialCheck.missingSceneIndices).toHaveLength(scenes.length);

    // Upload clip for Scene 1 only
    const uploadedClip1 = await saveUploadedSceneClip(
      ownerId,
      {
        contentId: content.id,
        sceneId: scenes[0]!.id,
        originalFilename: "CO-2026-001_SCENE_001.mp4",
        mimeType: "video/mp4",
        clipBuffer: Buffer.from("fake-mp4-scene-1"),
        replaceExistingForScene: false,
      },
      { storePath: tempStorePath, forceLocal: true }
    );
    expect(uploadedClip1.asset.originalFilename).toBe("Bagian 1.mp4");
    expect(uploadedClip1.asset.metadata?.rawUploadedFilename).toBe("CO-2026-001_SCENE_001.mp4");

    // Upload a duplicate clip for Scene 1 without replacing
    await saveUploadedSceneClip(
      ownerId,
      {
        contentId: content.id,
        sceneId: scenes[0]!.id,
        originalFilename: "CO-2026-001_SCENE_001_dup.mp4",
        mimeType: "video/mp4",
        clipBuffer: Buffer.from("fake-mp4-scene-1-dup"),
        replaceExistingForScene: false,
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    const assetsAfterDup = await listAssetsForContent(ownerId, content.id, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    const dupCheck = evaluateClipCompleteness(scenes, assetsAfterDup);
    expect(dupCheck.duplicateSceneIndices).toContain(1);
    expect(dupCheck.readyForAssembly).toBe(false);
  });
});
