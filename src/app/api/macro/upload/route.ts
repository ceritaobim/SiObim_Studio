import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
  runContentVideoAssembly,
  saveUploadedSceneClip,
} from "@/lib/db/repository";
import { evaluateClipCompleteness } from "@/features/video-generation/clip-matcher";

export const dynamic = "force-dynamic";

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
    const formData = await request.formData();
    const file = formData.get("file");
    const explicitContentCode = String(formData.get("contentCode") ?? "").trim();
    const explicitSceneIndex = Number(formData.get("sceneIndex") ?? 0);

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Pilih file video (.mp4) untuk diunggah." },
        { status: 400 }
      );
    }

    const items = await listContentItems(owner.ownerId);
    let targetItem = explicitContentCode
      ? items.find((i) => i.contentCode.toUpperCase() === explicitContentCode.toUpperCase())
      : undefined;

    // Detect from filename if not explicitly provided
    if (!targetItem) {
      const codeMatch = file.name.match(/CO-\d{4}-\d{3}/i) || file.name.match(/CO-\d{3}/i);
      if (codeMatch) {
        targetItem = items.find((i) => i.contentCode.toUpperCase() === codeMatch[0].toUpperCase());
      }
    }

    if (!targetItem) {
      return NextResponse.json(
        { error: "Kode konten tidak ditemukan atau tidak cocok dengan daftar konten aktif." },
        { status: 404 }
      );
    }

    const currentScenes = await listScenesForContent(owner.ownerId, targetItem.id);
    let targetSceneIndex = explicitSceneIndex;

    if (!targetSceneIndex) {
      const sceneMatch =
        file.name.match(/SCENE[_\s-]*0*(\d+)/i) ||
        file.name.match(/Bagian[_\s-]*0*(\d+)/i) ||
        file.name.match(/_0*(\d+)\.mp4$/i);
      if (sceneMatch && sceneMatch[1]) {
        targetSceneIndex = parseInt(sceneMatch[1], 10);
      }
    }

    const targetScene = currentScenes.find((s) => s.sceneIndex === targetSceneIndex);
    if (!targetScene) {
      return NextResponse.json(
        { error: `Bagian ${targetSceneIndex} tidak ditemukan pada konten ${targetItem.contentCode}.` },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveUploadedSceneClip(owner.ownerId, {
      contentId: targetItem.id,
      sceneId: targetScene.id,
      originalFilename: file.name,
      mimeType: file.type || "video/mp4",
      clipBuffer: buffer,
      replaceExistingForScene: true,
    });

    const [latestScenes, latestAssets] = await Promise.all([
      listScenesForContent(owner.ownerId, targetItem.id),
      listAssetsForContent(owner.ownerId, targetItem.id),
    ]);

    const completeness = evaluateClipCompleteness(latestScenes, latestAssets);
    const hasVoice = latestAssets.some((a) => a.assetType === "voice_audio");

    let autoAssembled = false;
    let finalVideoAsset = null;
    let assemblyMessage = "";

    if (completeness.readyForAssembly && hasVoice) {
      try {
        const assemblyRes = await runContentVideoAssembly(owner.ownerId, targetItem.id, {
          forceReassemble: true,
        });
        finalVideoAsset = assemblyRes.finalVideoAsset;
        autoAssembled = true;
        assemblyMessage = "Seluruh bagian klip telah lengkap! Video final 00Final.mp4 berhasil dirakit dengan audio & disinkronkan ke Google Drive.";
      } catch (err) {
        assemblyMessage = `Perakitan final gagal: ${err instanceof Error ? err.message : "Error FFmpeg"}`;
      }
    } else if (completeness.readyForAssembly && !hasVoice) {
      assemblyMessage = "Seluruh bagian klip telah lengkap! Menunggu audio voice over digenerate di menu Voice Over untuk perakitan final.";
    }

    return NextResponse.json({
      ok: true,
      message: `Klip ${file.name} berhasil di-ingest sebagai ${saved.asset.originalFilename} pada ${targetItem.contentCode}. ${assemblyMessage}`,
      savedAsset: saved.asset,
      completeness,
      autoAssembled,
      finalVideoAsset,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal meng-ingest video makro." },
      { status: 500 }
    );
  }
}
