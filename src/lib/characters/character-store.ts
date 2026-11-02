import fs from "fs";
import path from "path";
import crypto from "crypto";

export type CharacterRoleType = "main" | "supporting";

export interface StudioCharacterRecord {
  id: string;
  name: string;
  role: CharacterRoleType; // "main" = Karakter Utama, "supporting" = Karakter Sampingan
  voiceId: string; // 1 Karakter = 1 Suara ElevenLabs
  voiceName: string;
  visualCharacteristics: string; // Warna kertas origami, pakaian, proporsi, aksesoris
  personalityTraits: string; // Sifat, ekspresi khas, gestur tubuh
  promptKeywordsEn: string; // Deskripsi bahasa Inggris siap tempel ke prompt Google Flow
  imageFilename: string | null; // Disimpan di storage/characters/<filename>
  imageMimeType: string | null;
  isActiveDefault: boolean; // Jika true, otomatis disertakan saat generate prompt video
  createdAt: string;
  updatedAt: string;
}

const CHARACTERS_JSON_PATH = path.join(
  process.cwd(),
  "storage",
  "characters.local.json"
);

const CHARACTERS_IMAGE_DIR = path.join(
  process.cwd(),
  "storage",
  "characters"
);

function buildDefaultCharacters(): StudioCharacterRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: "char-main-obim",
      name: "Obim",
      role: "main",
      voiceId: "gemini-kid-puck-bold",
      voiceName:
        "Puck Bold (Gemini AI) — Anak Laki-Laki Optimis, Semangat & Bold",
      visualCharacteristics:
        "Figur anak muda ramah dari lipatan kertas origami bertekstur doff (matte craft paper). Rambut potongan mangkuk/jamur (bowl-cut) dari lipatan kertas biru-hitam gelap berlipit vertikal rapi. Wajah kertas warna krem hangat dengan mata melengkung tersenyum ramah (happy closed-eye smile). Memakai kemeja flanel lengan panjang motif kotak-kotak merah-hitam-putih (red-black-white plaid flannel paper shirt) dengan lengan digulung sesiku, celana panjang kertas biru dongker (dark navy-blue folded paper pants), dan sepatu kertas cokelat tua.",
      personalityTraits:
        "Ramah, selalu tersenyum hangat, penasaran, ekspresif namun tenang saat menjelaskan fakta psikologi & kehidupan sehari-hari.",
      promptKeywordsEn:
        "Obim (3D handmade folded matte origami paper boy figure with dark navy-black pleated bowl-cut mushroom hair, warm beige faceted paper face with happy smiling curved eyes, wearing a red-black-white tartan plaid flannel folded-paper collared shirt with rolled sleeves, dark navy-blue folded paper trousers, and dark brown paper shoes; tactile paper texture and visible geometric creases)",
      imageFilename: "char-main-obim-default.jpg",
      imageMimeType: "image/jpeg",
      isActiveDefault: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function listStudioCharacters(): StudioCharacterRecord[] {
  try {
    if (!fs.existsSync(CHARACTERS_JSON_PATH)) {
      const initial = buildDefaultCharacters();
      saveStudioCharactersList(initial);
      return initial;
    }
    const raw = fs.readFileSync(CHARACTERS_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as StudioCharacterRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = buildDefaultCharacters();
      saveStudioCharactersList(initial);
      return initial;
    }

    // Ensure default Obim always has the latest default photo, voice, & traits if missing
    let updated = false;
    const def = buildDefaultCharacters()[0]!;
    const synced = parsed.map((c) => {
      if (
        c.id === "char-main-obim" &&
        (!c.imageFilename ||
          !c.voiceId ||
          c.voiceId === "TX3LPaxmHKxFdv7VOQHJ" ||
          c.voiceId === "SOYHLrjzK2X1ezoPC6cr" ||
          c.voiceId === "cgSgspJ2msm6clMCkdW9")
      ) {
        updated = true;
        return {
          ...c,
          voiceId: def.voiceId,
          voiceName: def.voiceName,
          visualCharacteristics:
            c.visualCharacteristics || def.visualCharacteristics,
          personalityTraits: c.personalityTraits || def.personalityTraits,
          promptKeywordsEn: c.promptKeywordsEn || def.promptKeywordsEn,
          imageFilename: c.imageFilename || def.imageFilename,
          imageMimeType: c.imageMimeType || def.imageMimeType,
        };
      }
      if (!c.voiceId) {
        updated = true;
        return {
          ...c,
          voiceId: def.voiceId,
          voiceName: def.voiceName,
        };
      }
      return c;
    });

    if (updated) {
      saveStudioCharactersList(synced);
    }
    return synced;
  } catch {
    return buildDefaultCharacters();
  }
}

export function saveStudioCharactersList(list: StudioCharacterRecord[]): void {
  const dir = path.dirname(CHARACTERS_JSON_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CHARACTERS_JSON_PATH, JSON.stringify(list, null, 2), "utf8");
}

export function upsertStudioCharacter(input: {
  id?: string;
  name: string;
  role: CharacterRoleType;
  voiceId?: string;
  voiceName?: string;
  visualCharacteristics: string;
  personalityTraits: string;
  promptKeywordsEn?: string;
  isActiveDefault?: boolean;
  imageBuffer?: Buffer;
  imageOriginalName?: string;
  imageMimeType?: string;
}): StudioCharacterRecord {
  const list = listStudioCharacters();
  const now = new Date().toISOString();

  const existingIndex = input.id
    ? list.findIndex((c) => c.id === input.id)
    : -1;
  const targetId =
    existingIndex >= 0
      ? list[existingIndex]!.id
      : `char-${input.role}-${crypto.randomUUID().slice(0, 6)}`;

  let savedFilename =
    existingIndex >= 0 ? list[existingIndex]!.imageFilename : null;
  let savedMimeType =
    existingIndex >= 0 ? list[existingIndex]!.imageMimeType : null;

  if (input.imageBuffer && input.imageBuffer.length > 0) {
    if (!fs.existsSync(CHARACTERS_IMAGE_DIR)) {
      fs.mkdirSync(CHARACTERS_IMAGE_DIR, { recursive: true });
    }
    const ext =
      (input.imageOriginalName || "")
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "png";
    savedFilename = `${targetId}-${Date.now()}.${ext}`;
    savedMimeType = input.imageMimeType || "image/png";
    fs.writeFileSync(
      path.join(CHARACTERS_IMAGE_DIR, savedFilename),
      input.imageBuffer
    );
  }

  const autoPromptEn =
    (input.promptKeywordsEn || "").trim() ||
    `${input.name.trim()} (handmade folded matte origami paper character: ${input.visualCharacteristics.trim()}, ${input.personalityTraits.trim()})`;

  const resolvedVoiceId =
    (input.voiceId || "").trim() ||
    (existingIndex >= 0 ? list[existingIndex]!.voiceId : "") ||
    "gemini-kid-puck-bold";
  const resolvedVoiceName =
    (input.voiceName || "").trim() ||
    (existingIndex >= 0 ? list[existingIndex]!.voiceName : "") ||
    "Puck Bold (Gemini AI) — Anak Laki-Laki Optimis, Semangat & Bold";

  const record: StudioCharacterRecord = {
    id: targetId,
    name: input.name.trim(),
    role: input.role,
    voiceId: resolvedVoiceId,
    voiceName: resolvedVoiceName,
    visualCharacteristics: input.visualCharacteristics.trim(),
    personalityTraits: input.personalityTraits.trim(),
    promptKeywordsEn: autoPromptEn,
    imageFilename: savedFilename,
    imageMimeType: savedMimeType,
    isActiveDefault:
      input.isActiveDefault !== undefined
        ? input.isActiveDefault
        : existingIndex >= 0
        ? list[existingIndex]!.isActiveDefault
        : input.role === "main",
    createdAt:
      existingIndex >= 0 ? list[existingIndex]!.createdAt : now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    list[existingIndex] = record;
  } else {
    list.push(record);
  }

  saveStudioCharactersList(list);
  return record;
}

export function getActiveMainCharacterVoice(): {
  characterName: string;
  voiceId: string;
  voiceName: string;
} {
  const list = listStudioCharacters();
  const mainChar =
    list.find((c) => c.role === "main" && c.isActiveDefault) ??
    list.find((c) => c.role === "main") ??
    list[0];

  return {
    characterName: mainChar?.name || "Obim",
    voiceId: mainChar?.voiceId || "gemini-kid-puck-bold",
    voiceName:
      mainChar?.voiceName ||
      "Puck Bold (Gemini AI) — Anak Laki-Laki Optimis, Semangat & Bold",
  };
}

export function deleteStudioCharacter(id: string): StudioCharacterRecord[] {
  const list = listStudioCharacters();
  const target = list.find((c) => c.id === id);
  if (target?.imageFilename) {
    const imgPath = path.join(CHARACTERS_IMAGE_DIR, target.imageFilename);
    if (fs.existsSync(imgPath)) {
      try {
        fs.unlinkSync(imgPath);
      } catch {
        // ignore
      }
    }
  }
  const filtered = list.filter((c) => c.id !== id);
  saveStudioCharactersList(filtered);
  return filtered;
}

export function getCharacterImageBuffer(filename: string): {
  buffer: Buffer;
  mimeType: string;
} | null {
  const safeName = path.basename(filename);
  const fullPath = path.join(CHARACTERS_IMAGE_DIR, safeName);
  if (!fs.existsSync(fullPath)) return null;
  const ext = safeName.split(".").pop()?.toLowerCase();
  const mimeType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
      ? "image/webp"
      : "image/png";
  return {
    buffer: fs.readFileSync(fullPath),
    mimeType,
  };
}

export function buildActiveCharactersPromptSummary(): string {
  const list = listStudioCharacters();
  const activeMain = list.filter((c) => c.role === "main" && c.isActiveDefault);
  const activeSupporting = list.filter(
    (c) => c.role === "supporting" && c.isActiveDefault
  );

  const parts: string[] = [];
  if (activeMain.length > 0) {
    parts.push(
      `MAIN CHARACTER(S): ${activeMain
        .map(
          (c) =>
            `${c.name} — ${c.visualCharacteristics} (${c.personalityTraits}) [${c.promptKeywordsEn}]`
        )
        .join(" | ")}`
    );
  }
  if (activeSupporting.length > 0) {
    parts.push(
      `SUPPORTING CHARACTER(S) (Use when scene involves friends/others): ${activeSupporting
        .map(
          (c) =>
            `${c.name} — ${c.visualCharacteristics} (${c.personalityTraits}) [${c.promptKeywordsEn}]`
        )
        .join(" | ")}`
    );
  }
  return parts.join("\n");
}
