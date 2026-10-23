import fs from "fs";
import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { listAssetsForContent, listContentItems } from "@/lib/db/repository";

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
  const download = url.searchParams.get("download") === "1";

  const items = await listContentItems(owner.ownerId, {
    includeArchived: true,
  });

  let targetAsset = null;
  if (contentId) {
    const assets = await listAssetsForContent(owner.ownerId, contentId);
    targetAsset =
      (assetId ? assets.find((a) => a.id === assetId) : null) ??
      assets.find((a) => a.assetType === "voice_audio") ??
      null;
  } else {
    for (const item of items) {
      const assets = await listAssetsForContent(owner.ownerId, item.id);
      const found = assets.find(
        (a) => a.id === assetId && a.assetType === "voice_audio"
      );
      if (found) {
        targetAsset = found;
        break;
      }
    }
  }

  if (!targetAsset || !targetAsset.storagePath) {
    return NextResponse.json(
      { error: "File audio belum tersedia untuk konten ini." },
      { status: 404 }
    );
  }

  if (!fs.existsSync(targetAsset.storagePath)) {
    return NextResponse.json(
      {
        error:
          "File audio fisik tidak ditemukan di disk. Silakan klik Generate Ulang Audio.",
      },
      { status: 404 }
    );
  }

  const stat = fs.statSync(targetAsset.storagePath);
  const fileSize = stat.size;
  const mimeType =
    targetAsset.mimeType ||
    (targetAsset.storagePath.endsWith(".wav") ? "audio/wav" : "audio/mpeg");

  const rangeHeader = request.headers.get("range");

  // Handle HTTP Range request (needed for audio player seeking)
  if (rangeHeader && !download) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0] || "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const nodeStream = fs.createReadStream(targetAsset.storagePath, {
      start,
      end,
    });
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk));
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        nodeStream.destroy();
      },
    });

    const headers = new Headers();
    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(chunkSize));
    headers.set("Content-Type", mimeType);
    headers.set("Cache-Control", "no-cache");

    return new NextResponse(webStream, {
      status: 206,
      headers,
    });
  }

  // Full response with Accept-Ranges declared
  const nodeStream = fs.createReadStream(targetAsset.storagePath);
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });

  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Content-Length", String(fileSize));
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-cache");
  if (download) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="${targetAsset.originalFilename || "voice.mp3"}"`
    );
  }

  return new NextResponse(webStream, {
    status: 200,
    headers,
  });
}
