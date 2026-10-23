import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  generateAndSaveScenePrompts,
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
  saveUploadedSceneClip,
} from "@/lib/db/repository";
import {
  evaluateClipCompleteness,
  matchFilenameToScene,
} from "@/features/video-generation/clip-matcher";

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

  const items = await listContentItems(owner.ownerId);
  const targetContentId = contentId || items[0]?.id || "";
  const selectedContent = items.find((i) => i.id === targetContentId) ?? null;

  const [rawScenes, assets] = selectedContent
    ? await Promise.all([
        listScenesForContent(owner.ownerId, selectedContent.id),
        listAssetsForContent(owner.ownerId, selectedContent.id),
      ])
    : [[], []];

  const hasVoice = assets.some(
    (a) => a.contentId === selectedContent?.id && a.assetType === "voice_audio"
  );
  let scenes = hasVoice ? rawScenes : [];
  if (hasVoice && scenes.length === 0 && selectedContent) {
    try {
      scenes = await generateAndSaveScenePrompts(
        owner.ownerId,
        selectedContent.id,
        { retranscribeAudio: true }
      );
    } catch {
      scenes = [];
    }
  }

  const completeness = evaluateClipCompleteness(scenes, assets);

  return NextResponse.json({
    items,
    selectedContent,
    scenes,
    assets,
    completeness,
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

    // Case 1: Multipart multi-file clip upload from semi-manual Google Flow
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const contentId = String(formData.get("contentId") ?? "").trim();
      const explicitSceneId = String(formData.get("sceneId") ?? "").trim();
      const replaceExisting =
        String(formData.get("replaceExisting") ?? "false") === "true";
      const files = formData.getAll("files");

      if (!contentId) {
        return NextResponse.json(
          { error: "Pilih konten terlebih dahulu." },
          { status: 400 }
        );
      }

      if (files.length === 0) {
        return NextResponse.json(
          { error: "Pilih minimal satu file video klip (.mp4)." },
          { status: 400 }
        );
      }

      const existingAssets = await listAssetsForContent(owner.ownerId, contentId);
      const hasVoice = existingAssets.some(
        (a) => a.contentId === contentId && a.assetType === "voice_audio"
      );
      if (!hasVoice) {
        return NextResponse.json(
          {
            error:
              "Audio voice over belum digenerate untuk konten ini. Silakan generate audio di menu Voice Over terlebih dahulu sebelum mengunggah klip.",
          },
          { status: 400 }
        );
      }

      let currentScenes = await listScenesForContent(owner.ownerId, contentId);
      if (currentScenes.length === 0) {
        currentScenes = await generateAndSaveScenePrompts(
          owner.ownerId,
          contentId
        );
      }

      const validFiles: File[] = files.filter(
        (f): f is File => f instanceof File
      );

      const { matchBatchFilesToScenes } = await import(
        "@/features/video-generation/clip-matcher"
      );

      // If user selected an explicit single scene target, map directly; otherwise use intelligent batch mapper
      const matchCandidates =
        explicitSceneId && validFiles.length === 1
          ? [
              {
                file: validFiles[0],
                matchedSceneIndex:
                  currentScenes.find((s) => s.id === explicitSceneId)
                    ?.sceneIndex ?? null,
                matchedSceneId: explicitSceneId,
                expectedFilename:
                  currentScenes.find((s) => s.id === explicitSceneId)
                    ?.expectedFilename ?? null,
                reason: "Dipetakan manual ke scene yang dipilih",
              },
            ]
          : matchBatchFilesToScenes(validFiles, currentScenes);

      const matchSummary = [];
      for (const candidate of matchCandidates) {
        if (!(candidate.file instanceof File)) continue;

        const buf = Buffer.from(await candidate.file.arrayBuffer());
        const saved = await saveUploadedSceneClip(owner.ownerId, {
          contentId,
          sceneId: candidate.matchedSceneId,
          originalFilename: candidate.file.name,
          mimeType: candidate.file.type || "video/mp4",
          clipBuffer: buf,
          replaceExistingForScene: replaceExisting,
        });
        currentScenes = saved.scenes;
        matchSummary.push({
          filename: candidate.file.name,
          rawFilename: candidate.file.name,
          renamedFilename: saved.asset.originalFilename,
          sceneIndex: candidate.matchedSceneIndex,
          sceneId: candidate.matchedSceneId,
          reason: candidate.reason,
        });
      }

      let assets = await listAssetsForContent(owner.ownerId, contentId);
      const completeness = evaluateClipCompleteness(currentScenes, assets);

      let finalVideoAsset = null;
      let assemblyError: string | null = null;
      let autoAssembled = false;

      // Auto-trigger assembly of "00Final" if all parts are complete!
      if (completeness.readyForAssembly) {
        try {
          const { runContentVideoAssembly } = await import(
            "@/lib/db/repository"
          );
          const assemblyRes = await runContentVideoAssembly(
            owner.ownerId,
            contentId
          );
          finalVideoAsset = assemblyRes.finalVideoAsset;
          autoAssembled = true;
          assets = await listAssetsForContent(owner.ownerId, contentId);
        } catch (assemblyErr) {
          assemblyError =
            assemblyErr instanceof Error
              ? assemblyErr.message
              : "Gagal merakit 00Final secara otomatis.";
        }
      }

      return NextResponse.json(
        {
          scenes: currentScenes,
          assets,
          completeness,
          matchSummary,
          finalVideoAsset,
          assemblyError,
          autoAssembled,
        },
        { status: 201 }
      );
    }

    // Case 2: JSON request (Open Playwright Browser, Auto-Generate Video via Playwright, or Transcribe Audio & Generate Prompts)
    const body = await request.json();
    const action = String(body.action ?? "generate_prompts").trim();

    if (action === "open_flow_browser") {
      const { openGoogleFlowSessionWindow } = await import(
        "@/lib/providers/video/playwright-flow-runner"
      );
      const res = await openGoogleFlowSessionWindow(
        body.flowUrl ? String(body.flowUrl) : undefined
      );
      return NextResponse.json(res);
    }

    const contentId = String(body.contentId ?? "").trim();
    const retranscribeAudio = Boolean(body.retranscribeAudio);
    if (!contentId) {
      return NextResponse.json(
        { error: "contentId wajib diisi." },
        { status: 400 }
      );
    }

    if (action === "sync_gdrive") {
      const { syncContentVideosToGoogleDrive } = await import(
        "@/lib/db/repository"
      );
      const res = await syncContentVideosToGoogleDrive(
        owner.ownerId,
        contentId
      );
      return NextResponse.json(res);
    }

    const existingAssets = await listAssetsForContent(owner.ownerId, contentId);
    const hasVoice = existingAssets.some(
      (a) => a.contentId === contentId && a.assetType === "voice_audio"
    );
    if (!hasVoice) {
      return NextResponse.json(
        {
          error:
            "Audio voice over belum digenerate untuk video ini. Transkrip dan pemotongan bagian hanya dapat dibuat setelah audio digenerate di menu Voice Over.",
        },
        { status: 400 }
      );
    }

    if (action === "playwright_generate_part") {
      const sceneId = String(body.sceneId ?? "").trim();
      const promptOverride = String(body.promptText ?? "").trim();
      let currentScenes = await listScenesForContent(owner.ownerId, contentId);
      if (currentScenes.length === 0) {
        currentScenes = await generateAndSaveScenePrompts(
          owner.ownerId,
          contentId,
          { retranscribeAudio: true }
        );
      }

      const targetScene =
        currentScenes.find((s) => s.id === sceneId) ?? currentScenes[0];
      if (!targetScene) {
        return NextResponse.json(
          { error: "Bagian/Scene tidak ditemukan." },
          { status: 404 }
        );
      }

      const items = await listContentItems(owner.ownerId);
      const content = items.find((i) => i.id === contentId);
      const contentCode = content?.contentCode ?? "CO-2026-000";

      const { generateClipWithPlaywrightFlow } = await import(
        "@/lib/providers/video/playwright-flow-runner"
      );

      const flowResult = await generateClipWithPlaywrightFlow({
        contentCode,
        partIndex: targetScene.sceneIndex,
        expectedFilename: targetScene.expectedFilename,
        promptText: promptOverride || targetScene.promptText,
      });

      if (flowResult.ok && flowResult.videoBuffer) {
        const saved = await saveUploadedSceneClip(owner.ownerId, {
          contentId,
          sceneId: targetScene.id,
          originalFilename: targetScene.expectedFilename,
          mimeType: flowResult.mimeType || "video/mp4",
          clipBuffer: flowResult.videoBuffer,
          replaceExistingForScene: true,
        });
        const assets = await listAssetsForContent(owner.ownerId, contentId);
        const completeness = evaluateClipCompleteness(saved.scenes, assets);

        return NextResponse.json({
          ok: true,
          status: flowResult.status,
          message: `${flowResult.message} (Tersimpan & terupload otomatis ke Google Drive!)`,
          scenes: saved.scenes,
          assets,
          completeness,
        });
      }

      const assets = await listAssetsForContent(owner.ownerId, contentId);
      const completeness = evaluateClipCompleteness(currentScenes, assets);

      return NextResponse.json({
        ok: false,
        status: flowResult.status,
        message: flowResult.message,
        scenes: currentScenes,
        assets,
        completeness,
      });
    }

    const scenes = await generateAndSaveScenePrompts(owner.ownerId, contentId, {
      retranscribeAudio,
    });
    const assets = await listAssetsForContent(owner.ownerId, contentId);
    const completeness = evaluateClipCompleteness(scenes, assets);

    return NextResponse.json({
      scenes,
      assets,
      completeness,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal memproses prompt atau unggahan klip scene.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
