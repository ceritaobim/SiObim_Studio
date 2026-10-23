import fs from "fs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  runContentVideoAssembly,
} from "@/lib/db/repository";

const RunAssemblySchema = z.object({
  contentId: z.string().uuid("ID konten tidak valid."),
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
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": stats.size.toString(),
          "Content-Disposition": `attachment; filename="${finalVideoAsset.originalFilename}"`,
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
