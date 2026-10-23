import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  adjustSceneTimestampsAndText,
  getProjectSettings,
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
  saveVoiceAssetAndSegmentScenes,
  syncContentAudioToGoogleDrive,
} from "@/lib/db/repository";
import {
  getActiveTTSProviderFromVault,
  recordGeminiTtsUsageForActiveProfile,
  recordUsedCreditsForActiveProfile,
} from "@/lib/providers/account-profiles";
import { getActiveMainCharacterVoice } from "@/lib/characters/character-store";
import { cleanNarrationForSpeech } from "@/lib/providers/tts/tts-provider";
import { validateScenesIntegrity } from "@/features/scenes/scene-segmenter";
import type { WordAlignmentSpan } from "@/types/domain";

export async function GET(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const contentId = url.searchParams.get("contentId");

  const [items, settings] = await Promise.all([
    listContentItems(owner.ownerId),
    getProjectSettings(owner.ownerId),
  ]);

  const targetContentId = contentId || items[0]?.id || "";
  const targetContent = items.find((i) => i.id === targetContentId) ?? null;

  const [scenes, assets] = targetContent
    ? await Promise.all([
        listScenesForContent(owner.ownerId, targetContent.id),
        listAssetsForContent(owner.ownerId, targetContent.id),
      ])
    : [[], []];

  const validationReport =
    targetContent && scenes.length > 0
      ? validateScenesIntegrity(
          targetContent.narration,
          scenes,
          settings.targetSceneSecondsMin,
          settings.targetSceneSecondsMax
        )
      : null;

  return NextResponse.json({
    items,
    selectedContent: targetContent,
    scenes,
    assets,
    validationReport,
  });
}

export async function POST(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    // Case 1: Multipart form upload (Manual MP3 + optional alignment JSON)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const contentId = String(formData.get("contentId") ?? "").trim();
      const audioFile = formData.get("audioFile");
      const alignmentJsonRaw = String(
        formData.get("alignmentJson") ?? ""
      ).trim();
      const manualDurationSeconds = Number(
        formData.get("durationSeconds") ?? 70
      );

      if (!contentId) {
        return NextResponse.json(
          { error: "Pilih konten terlebih dahulu." },
          { status: 400 }
        );
      }

      if (!audioFile || !(audioFile instanceof File)) {
        return NextResponse.json(
          { error: "Pilih file audio (.mp3 / .wav) untuk diunggah." },
          { status: 400 }
        );
      }

      let wordSpans: WordAlignmentSpan[] | undefined;
      if (alignmentJsonRaw) {
        try {
          const parsed = JSON.parse(alignmentJsonRaw);
          if (Array.isArray(parsed)) {
            wordSpans = parsed.map((w) => ({
              word: String(w.word ?? ""),
              startMs: Number(w.startMs ?? 0),
              endMs: Number(w.endMs ?? 100),
            }));
          }
        } catch {
          return NextResponse.json(
            {
              error:
                "Format JSON Alignment tidak valid. Gunakan array [{ word, startMs, endMs }].",
            },
            { status: 400 }
          );
        }
      }

      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const result = await saveVoiceAssetAndSegmentScenes(owner.ownerId, {
        contentId,
        audioBuffer: buffer,
        originalFilename: audioFile.name,
        mimeType: audioFile.type || "audio/mpeg",
        durationMs: Math.max(5000, Math.round(manualDurationSeconds * 1000)),
        providerKey: "manual_upload",
        providerModel: "user_mp3_upload",
        wordSpans,
        timestampStatus: wordSpans && wordSpans.length > 0 ? "actual" : "estimated",
      });

      return NextResponse.json(result, { status: 201 });
    }

    // Case 2: JSON request (TTS synthesis or Google Drive audio sync)
    const body = await request.json();
    const action = String(body.action ?? "synthesize").trim();
    const contentId = String(body.contentId ?? "").trim();
    if (!contentId) {
      return NextResponse.json(
        { error: "contentId wajib diisi." },
        { status: 400 }
      );
    }

    if (action === "sync_gdrive") {
      const syncResult = await syncContentAudioToGoogleDrive(
        owner.ownerId,
        contentId
      );
      return NextResponse.json(syncResult, { status: 200 });
    }

    if (action === "retranscribe") {
      const fs = await import("fs");
      const assets = await listAssetsForContent(owner.ownerId, contentId);
      const voiceAsset = assets.find((a) => a.assetType === "voice_audio");
      if (!voiceAsset || !fs.existsSync(voiceAsset.storagePath)) {
        return NextResponse.json(
          { error: "File audio belum ada untuk konten ini." },
          { status: 400 }
        );
      }

      const items = await listContentItems(owner.ownerId, {
        includeArchived: true,
      });
      const targetContent = items.find((i) => i.id === contentId);

      const { transcribeAndSegmentAudioFile } = await import(
        "@/lib/providers/tts/audio-transcriber"
      );
      const transcribed = await transcribeAndSegmentAudioFile({
        contentId: contentId,
        contentCode: targetContent?.contentCode || "CO-TEMP",
        fallbackNarrationText: targetContent?.narration || "",
        audioFilePath: voiceAsset.storagePath,
        mimeType: voiceAsset.mimeType,
        totalDurationMs: voiceAsset.durationMs ?? 0,
      });

      const { saveScenesForContent, getProjectSettings } = await import(
        "@/lib/db/repository"
      );
      const settings = await getProjectSettings(owner.ownerId);
      const { buildPromptsForScenes } = await import(
        "@/features/scenes/prompt-generator"
      );
      const { buildActiveCharactersPromptSummary } = await import(
        "@/lib/characters/character-store"
      );

      let finalScenes = transcribed.scenes;
      if (targetContent) {
        finalScenes = buildPromptsForScenes({
          settings,
          content: targetContent,
          scenes: finalScenes,
          characterRosterSummary: buildActiveCharactersPromptSummary(),
        });
      }

      await saveScenesForContent(owner.ownerId, contentId, finalScenes);

      return NextResponse.json({
        scenes: finalScenes,
        usedAiTranscription: transcribed.usedAiTranscription,
      });
    }

    const items = await listContentItems(owner.ownerId, {
      includeArchived: true,
    });
    const content = items.find((i) => i.id === contentId);
    if (!content) {
      return NextResponse.json(
        { error: "Konten tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!content.narration || content.narration.trim().length < 10) {
      return NextResponse.json(
        {
          error:
            "Narasi konten masih kosong atau terlalu pendek. Isi narasi di Content Library terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const mainCharacterVoice = getActiveMainCharacterVoice();
    const chosenVoiceId = body.voiceId || mainCharacterVoice.voiceId;
    const tts = getActiveTTSProviderFromVault(undefined, chosenVoiceId);
    const synthesis = await tts.synthesize({
      contentId: content.id,
      contentCode: content.contentCode,
      narrationText: content.narration,
      voiceId: chosenVoiceId,
    });

    if (synthesis.providerKey === "elevenlabs") {
      recordUsedCreditsForActiveProfile(
        cleanNarrationForSpeech(content.narration).length
      );
    } else if (synthesis.providerKey === "gemini_tts") {
      recordGeminiTtsUsageForActiveProfile();
    }

    const ext = synthesis.mimeType.includes("wav") ? "wav" : "mp3";
    const result = await saveVoiceAssetAndSegmentScenes(owner.ownerId, {
      contentId: content.id,
      audioBuffer: synthesis.audioBuffer,
      originalFilename: `${content.contentCode}_VOICE.${ext}`,
      mimeType: synthesis.mimeType,
      durationMs: synthesis.durationMs,
      providerKey: synthesis.providerKey,
      providerModel: synthesis.providerModel,
      voiceId: synthesis.voiceId,
      providerRequestId: synthesis.providerRequestId,
      wordSpans: synthesis.wordSpans,
      timestampStatus: synthesis.timestampStatus,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal memproses voice-over dan pemotongan scene.";
    if (message.includes("429") && message.includes("GEMINI")) {
      recordGeminiTtsUsageForActiveProfile({ markExhausted429: true });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const result = await adjustSceneTimestampsAndText(owner.ownerId, {
      contentId: String(body.contentId ?? ""),
      sceneId: String(body.sceneId ?? ""),
      startMs: Number(body.startMs ?? 0),
      endMs: Number(body.endMs ?? 1000),
      narrationText: String(body.narrationText ?? ""),
      visualAction: body.visualAction,
      cameraDirection: body.cameraDirection,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyesuaikan batas scene.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
