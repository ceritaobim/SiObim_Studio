import fs from "fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
  runContentVideoAssembly,
} from "@/lib/db/repository";

const RunAssemblySchema = z.object({
  contentId: z.string().optional(),
  action: z.enum(["assemble", "batch_assemble"]).optional(),
  batch: z.boolean().optional(),
  forceReassemble: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId");
    const download = searchParams.get("download") === "1";

    if (!contentId) {
      return NextResponse.json(
        { error: "Parameter contentId wajib disertakan." },
        { status: 400 }
      );
    }

    const assets = await listAssetsForContent(owner.ownerId, contentId);
    let finalVideoAsset = assets.find((a) => a.assetType === "final_video");
    let assemblyLogAsset = assets.find((a) => a.assetType === "assembly_log");

    if (download) {
      if (
        !finalVideoAsset ||
        !fs.existsSync(finalVideoAsset.storagePath) ||
        fs.statSync(finalVideoAsset.storagePath).size < 100000
      ) {
        try {
          const result = await runContentVideoAssembly(
            owner.ownerId,
            contentId
          );
          finalVideoAsset = result.finalVideoAsset;
          assemblyLogAsset = result.assemblyLogAsset;
        } catch (assemblyErr) {
          const msg =
            assemblyErr instanceof Error
              ? assemblyErr.message
              : "Klip video per bagian belum lengkap untuk dirakit.";
          return NextResponse.json({ error: msg }, { status: 400 });
        }
      }

      if (!finalVideoAsset || !fs.existsSync(finalVideoAsset.storagePath)) {
        return NextResponse.json(
          { error: "File video master 9:16 belum dirakit untuk konten ini." },
          { status: 404 }
        );
      }

      const stats = fs.statSync(finalVideoAsset.storagePath);
      const fileBuffer = fs.readFileSync(finalVideoAsset.storagePath);
      const rawFilename = finalVideoAsset.originalFilename || "final-video.mp4";
      const downloadFilename = rawFilename.startsWith("final-")
        ? rawFilename
        : `final-${rawFilename.replace(/_MASTER_9x16\.mp4$/i, "").replace(/[?:/*"<>|\\]/g, "").trim()}.mp4`;
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": stats.size.toString(),
          "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        },
      });
    }

    return NextResponse.json({
      finalVideoAsset: finalVideoAsset ?? null,
      assemblyLogAsset: assemblyLogAsset ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memeriksa hasil rakitan video.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const body = await request.json();
    const parsed = RunAssemblySchema.parse(body);
    const forceReassemble =
      body.forceReassemble !== undefined ? Boolean(body.forceReassemble) : true;

    // Handle Batch Auto-Assembly
    const isBatch =
      parsed.action === "batch_assemble" ||
      parsed.batch === true ||
      parsed.contentId === "all";

    if (isBatch) {
      const items = await listContentItems(owner.ownerId);
      const allAssets = await listAssetsForContent(owner.ownerId);

      const assembledList: Array<{
        contentId: string;
        contentCode: string;
        title: string;
        filename: string;
      }> = [];
      const skippedList: Array<{
        contentId: string;
        contentCode: string;
        reason: string;
      }> = [];

      for (const item of items) {
        const itemAssets = allAssets.filter((a) => a.contentId === item.id);
        const hasFinal = itemAssets.some((a) => a.assetType === "final_video");

        if (hasFinal && !forceReassemble) {
          skippedList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            reason: "Sudah memiliki video final.",
          });
          continue;
        }

        const hasVoice = itemAssets.some((a) => a.assetType === "voice_audio");
        if (!hasVoice) {
          skippedList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            reason: "Voice-over belum dibuat.",
          });
          continue;
        }

        const scenes = await listScenesForContent(owner.ownerId, item.id);
        if (scenes.length === 0) {
          skippedList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            reason: "Scene belum di-generate.",
          });
          continue;
        }

        const sceneClips = itemAssets.filter((a) => a.assetType === "scene_video");
        const missingScenes = scenes.filter(
          (s) => !sceneClips.some((c) => c.sceneId === s.id)
        );

        if (missingScenes.length > 0) {
          skippedList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            reason: `${missingScenes.length} dari ${scenes.length} klip adegan belum ada.`,
          });
          continue;
        }

        // Ready to assemble!
        try {
          const res = await runContentVideoAssembly(owner.ownerId, item.id, {
            forceReassemble,
          });
          assembledList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            title: item.title,
            filename: res.finalVideoAsset.originalFilename,
          });
        } catch (assemblyErr) {
          skippedList.push({
            contentId: item.id,
            contentCode: item.contentCode,
            reason:
              assemblyErr instanceof Error
                ? assemblyErr.message
                : "Gagal merakit klip.",
          });
        }
      }

      return NextResponse.json({
        ok: true,
        mode: "batch",
        totalItems: items.length,
        assembledCount: assembledList.length,
        skippedCount: skippedList.length,
        assembled: assembledList,
        skipped: skippedList,
        message:
          assembledList.length > 0
            ? `🎉 Berhasil merakit otomatis ${assembledList.length} video final master!`
            : "Semua konten yang klipnya lengkap sudah terakit.",
      });
    }

    // Handle Single Content Assembly
    if (!parsed.contentId) {
      return NextResponse.json(
        { error: "contentId wajib disertakan untuk perakitan tunggal." },
        { status: 400 }
      );
    }

    const result = await runContentVideoAssembly(
      owner.ownerId,
      parsed.contentId,
      { forceReassemble }
    );

    return NextResponse.json({
      job: result.job,
      finalVideoAsset: result.finalVideoAsset,
      assemblyLogAsset: result.assemblyLogAsset,
      manifest: result.assemblyResult.manifest,
      executionMode: result.assemblyResult.executionMode,
      logText: result.assemblyResult.logText,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal merakit video master 9:16.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
