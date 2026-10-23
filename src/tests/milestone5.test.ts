import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  calculateBatchCostEstimate,
  evaluateBudgetGuard,
} from "@/lib/costs/budget-guard";
import {
  buildDeterministicIdempotencyKey,
  canTransitionJobStatus,
  transitionProductionJob,
} from "@/lib/jobs/job-runner";
import {
  addBudgetLedgerEntry,
  enqueueOrGetIdempotentJob,
  generateAndSaveScenePrompts,
  listContentItems,
  runContentVideoAssembly,
  saveProductionJob,
  saveUploadedSceneClip,
  saveVoiceAssetAndSegmentScenes,
} from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";

describe("Milestone 5 — Durable Queue, Budget Guard, Idempotency & FFmpeg Assembly", () => {
  it("calculates best, expected, and worst-case batch cost estimates accurately", () => {
    const semiManual = calculateBatchCostEstimate({
      videoCount: 5,
      videoMode: "semi_manual_flow",
      llmIsPaidApi: true,
      ttsIsPaidApi: true,
      maxSceneRetries: 2,
    });
    expect(semiManual.breakdown.videoClipsUsd).toBe(0);
    expect(semiManual.bestCaseUsd).toBeGreaterThan(0);
    expect(semiManual.expectedCaseUsd).toBeGreaterThan(semiManual.bestCaseUsd);
    expect(semiManual.worstCaseUsd).toBeGreaterThan(
      semiManual.expectedCaseUsd
    );

    const apiUnknown = calculateBatchCostEstimate({
      videoCount: 3,
      videoMode: "api_provider",
      videoClipUnitCostUsd: null,
    });
    expect(apiUnknown.costCertainty).toBe("unknown_external_quota");
  });

  it("enforces daily and monthly budget caps and pauses jobs when budget is exceeded", async () => {
    const tmpStore = path.join(
      os.tmpdir(),
      `ceritaobim-m5-budget-${Date.now()}.json`
    );

    const evalOk = evaluateBudgetGuard({
      settings: { dailyBudgetLimit: 5, monthlyBudgetLimit: 30 },
      ledgerEntries: [],
      requestedAmountUsd: 2.5,
    });
    expect(evalOk.allowed).toBe(true);

    await addBudgetLedgerEntry(
      DEFAULT_OWNER_ID,
      {
        providerKey: "elevenlabs",
        eventType: "charge",
        amount: 9.5,
        unit: "USD",
        notes: "Pemakaian suara hari ini",
      },
      { storePath: tmpStore, forceLocal: true }
    );

    const items = await listContentItems(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });
    const content = items[0]!;

    const blockedResult = await enqueueOrGetIdempotentJob(
      DEFAULT_OWNER_ID,
      {
        contentId: content.id,
        jobType: "synthesize_voice",
        inputSignature: "voice-test-1",
        providerKey: "elevenlabs",
        providerModel: "eleven_multilingual_v2",
        estimatedCostUsd: 1.5, // 9.5 + 1.5 = 11.0 > 10.0 default daily limit
      },
      { storePath: tmpStore, forceLocal: true }
    );

    expect(blockedResult.budgetBlockedReason).toContain(
      "BUDGET_EXCEEDED_DAILY"
    );
    expect(blockedResult.job.status).toBe("paused");

    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  });

  it("enforces valid job transitions and idempotency so succeeded steps are never re-executed", async () => {
    const tmpStore = path.join(
      os.tmpdir(),
      `ceritaobim-m5-idempotent-${Date.now()}.json`
    );
    const items = await listContentItems(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });
    const content = items[0]!;

    expect(canTransitionJobStatus("queued", "running")).toBe(true);
    expect(canTransitionJobStatus("succeeded", "running")).toBe(false);

    const { idempotencyKey } = buildDeterministicIdempotencyKey({
      ownerId: DEFAULT_OWNER_ID,
      contentId: content.id,
      jobType: "synthesize_voice",
      inputSignature: "same-narration-hash",
    });
    expect(idempotencyKey).toContain("synthesize_voice:");

    const enqueued = await enqueueOrGetIdempotentJob(
      DEFAULT_OWNER_ID,
      {
        contentId: content.id,
        jobType: "synthesize_voice",
        inputSignature: "same-narration-hash",
        providerKey: "mock-tts",
        providerModel: "mock-v1",
        estimatedCostUsd: 0.1,
      },
      { storePath: tmpStore, forceLocal: true }
    );
    expect(enqueued.alreadySucceeded).toBe(false);

    const running = transitionProductionJob(enqueued.job, "running");
    const succeeded = transitionProductionJob(running, "succeeded", {
      outputAssetIds: ["asset-voice-1"],
      actualCost: 0.1,
    });
    await saveProductionJob(DEFAULT_OWNER_ID, succeeded, {
      storePath: tmpStore,
      forceLocal: true,
    });

    // Attempting to transition a succeeded job back to running throws IDEMPOTENT_SKIP_ALREADY_SUCCEEDED
    expect(() => transitionProductionJob(succeeded, "running")).toThrow(
      /IDEMPOTENT_SKIP_ALREADY_SUCCEEDED/
    );

    // Re-enqueuing the same step returns alreadySucceeded = true without re-running
    const secondCall = await enqueueOrGetIdempotentJob(
      DEFAULT_OWNER_ID,
      {
        contentId: content.id,
        jobType: "synthesize_voice",
        inputSignature: "same-narration-hash",
        providerKey: "mock-tts",
        providerModel: "mock-v1",
        estimatedCostUsd: 0.1,
      },
      { storePath: tmpStore, forceLocal: true }
    );
    expect(secondCall.alreadySucceeded).toBe(true);
    expect(secondCall.job.attemptCount).toBe(1);

    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  });

  it("blocks assembly when scene clips are missing and succeeds with 9:16 master MP4 when all clips + voice exist", async () => {
    const tmpStore = path.join(
      os.tmpdir(),
      `ceritaobim-m5-assembly-${Date.now()}.json`
    );
    const items = await listContentItems(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });
    const content = items[0]!;

    await saveVoiceAssetAndSegmentScenes(
      DEFAULT_OWNER_ID,
      {
        contentId: content.id,
        audioBuffer: Buffer.from("ID3-voice-narration"),
        originalFilename: "voice.mp3",
        mimeType: "audio/mpeg",
        durationMs: 24000,
        providerKey: "mock-tts",
        providerModel: "mock",
        timestampStatus: "actual",
      },
      { storePath: tmpStore, forceLocal: true }
    );

    const scenes = await generateAndSaveScenePrompts(
      DEFAULT_OWNER_ID,
      content.id,
      { storePath: tmpStore, forceLocal: true }
    );

    // 1. Assembly must fail when clips are missing
    await expect(
      runContentVideoAssembly(DEFAULT_OWNER_ID, content.id, {
        storePath: tmpStore,
        forceLocal: true,
      })
    ).rejects.toThrow(/ASSEMBLY_BLOCKED_MISSING_OR_DUPLICATE_CLIPS/);

    // 2. Upload all required scene clips
    for (const sc of scenes) {
      await saveUploadedSceneClip(
        DEFAULT_OWNER_ID,
        {
          contentId: content.id,
          sceneId: sc.id,
          originalFilename: sc.expectedFilename,
          mimeType: "video/mp4",
          clipBuffer: Buffer.from(`mock-clip-${sc.sceneIndex}`),
          replaceExistingForScene: true,
        },
        { storePath: tmpStore, forceLocal: true }
      );
    }

    // 3. Assembly now succeeds and creates 9:16 1080x1920 master MP4 + assembly log
    const assembled = await runContentVideoAssembly(
      DEFAULT_OWNER_ID,
      content.id,
      { storePath: tmpStore, forceLocal: true }
    );

    expect(assembled.job.status).toBe("succeeded");
    expect(assembled.finalVideoAsset.width).toBe(1080);
    expect(assembled.finalVideoAsset.height).toBe(1920);
    expect(assembled.finalVideoAsset.originalFilename).toBe(
      `${content.contentCode}_MASTER_9x16.mp4`
    );
    expect(
      assembled.assemblyResult.manifest.orderedScenes.map((s) => s.sceneIndex)
    ).toEqual(scenes.map((s) => s.sceneIndex));

    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  });
});
