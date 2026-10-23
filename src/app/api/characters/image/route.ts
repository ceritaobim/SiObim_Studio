import { NextResponse } from "next/server";
import { getCharacterImageBuffer } from "@/lib/characters/character-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const file = url.searchParams.get("file") || "";
  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const found = getCharacterImageBuffer(file);
  if (!found) {
    return NextResponse.json({ error: "Gambar tidak ditemukan." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(found.buffer), {
    status: 200,
    headers: {
      "Content-Type": found.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
