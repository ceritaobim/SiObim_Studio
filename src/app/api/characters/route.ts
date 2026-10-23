import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  deleteStudioCharacter,
  listStudioCharacters,
  upsertStudioCharacter,
  type CharacterRoleType,
} from "@/lib/characters/character-store";

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

  const characters = listStudioCharacters();
  return NextResponse.json({ characters });
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

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const id = String(formData.get("id") ?? "").trim() || undefined;
      const name = String(formData.get("name") ?? "").trim();
      const roleRaw = String(formData.get("role") ?? "main").trim();
      const role: CharacterRoleType =
        roleRaw === "supporting" ? "supporting" : "main";
      const voiceId = String(formData.get("voiceId") ?? "").trim();
      const voiceName = String(formData.get("voiceName") ?? "").trim();
      const visualCharacteristics = String(
        formData.get("visualCharacteristics") ?? ""
      ).trim();
      const personalityTraits = String(
        formData.get("personalityTraits") ?? ""
      ).trim();
      const promptKeywordsEn = String(
        formData.get("promptKeywordsEn") ?? ""
      ).trim();
      const isActiveDefault =
        String(formData.get("isActiveDefault") ?? "true") === "true";

      if (!name) {
        return NextResponse.json(
          { error: "Nama karakter wajib diisi." },
          { status: 400 }
        );
      }

      const imageFile = formData.get("imageFile");
      let imageBuffer: Buffer | undefined;
      let imageOriginalName: string | undefined;
      let imageMimeType: string | undefined;

      if (imageFile && imageFile instanceof File && imageFile.size > 0) {
        imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        imageOriginalName = imageFile.name;
        imageMimeType = imageFile.type || "image/png";
      }

      const saved = upsertStudioCharacter({
        id,
        name,
        role,
        voiceId,
        voiceName,
        visualCharacteristics,
        personalityTraits,
        promptKeywordsEn,
        isActiveDefault,
        imageBuffer,
        imageOriginalName,
        imageMimeType,
      });

      return NextResponse.json({
        character: saved,
        characters: listStudioCharacters(),
      });
    }

    // JSON actions (e.g., delete or toggle active)
    const body = await request.json();
    const action = String(body.action ?? "upsert").trim();

    if (action === "delete") {
      const id = String(body.id ?? "").trim();
      const remaining = deleteStudioCharacter(id);
      return NextResponse.json({ characters: remaining });
    }

    if (action === "toggle_active") {
      const id = String(body.id ?? "").trim();
      const all = listStudioCharacters();
      const target = all.find((c) => c.id === id);
      if (!target) {
        return NextResponse.json(
          { error: "Karakter tidak ditemukan." },
          { status: 404 }
        );
      }
      const saved = upsertStudioCharacter({
        id: target.id,
        name: target.name,
        role: target.role,
        visualCharacteristics: target.visualCharacteristics,
        personalityTraits: target.personalityTraits,
        promptKeywordsEn: target.promptKeywordsEn,
        isActiveDefault: !target.isActiveDefault,
      });
      return NextResponse.json({
        character: saved,
        characters: listStudioCharacters(),
      });
    }

    return NextResponse.json(
      { error: "Action tidak dikenali." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Gagal menyimpan data karakter.",
      },
      { status: 500 }
    );
  }
}
