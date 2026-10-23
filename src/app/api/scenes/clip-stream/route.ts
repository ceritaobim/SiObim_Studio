import fs from "fs";
import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { listAssetsForContent } from "@/lib/db/repository";

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
  const assetId = url.searchParams.get("assetId") ?? "";
  const contentId = url.searchParams.get("contentId") ?? "";
  const sceneId = url.searchParams.get("sceneId") ?? "";
  const download = url.searchParams.get("download") === "1";

  if (!contentId) {
    return NextResponse.json(
      { error: "Parameter contentId wajib disertakan." },
      { status: 400 }
    );
  }

  const assets = await listAssetsForContent(owner.ownerId, contentId);
  const targetAsset = assets.find((a) => {
    if (a.assetType !== "scene_video") return false;
    if (assetId && a.id === assetId) return true;
    if (sceneId && a.sceneId === sceneId) return true;
    return false;
  });

  if (!targetAsset || !targetAsset.storagePath) {
    return NextResponse.json(
      { error: "File video klip bagian belum tersedia." },
      { status: 404 }
    );
  }

  if (!fs.existsSync(targetAsset.storagePath)) {
    return NextResponse.json(
      { error: "File fisik video klip tidak ditemukan di disk." },
      { status: 404 }
    );
  }

  const fileBuffer = fs.readFileSync(targetAsset.storagePath);
  const filename = targetAsset.originalFilename || "bagian.mp4";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": targetAsset.mimeType || "video/mp4",
      "Content-Length": String(fileBuffer.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
