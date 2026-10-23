import * as XLSX from "xlsx";
import type {
  ContentItemRecord,
  ProjectSettingsSummary,
  SceneRecord,
} from "@/types/domain";

export interface PromptBuildInput {
  settings: ProjectSettingsSummary;
  content: Pick<ContentItemRecord, "contentCode" | "title" | "topic">;
  scenes: SceneRecord[];
  characterRosterSummary?: string;
}

export interface ProjectAndPartPromptsResult {
  transcriptFormattedText: string;
  projectPrompt: string;
  partPrompts: Array<{
    partIndex: number;
    startSec: number;
    endSec: number;
    durationSec: number;
    narrationText: string;
    expectedFilename: string;
    promptText: string;
  }>;
}

/**
 * Builds the unified base prompt containing all parts (`Bagian 1 [0-9] : ...`, `Bagian 2 [10-19] : ...`)
 * so that:
 * 1) Project Prompt = Base Prompt + "\n\nINSTRUKSI EKSEKUSI: Kerjakan semua bagian."
 * 2) Per-Bagian Prompt (Bagian X) = Base Prompt + `\n\nINSTRUKSI EKSEKUSI: Kerjakan bagian ${X} saja.`
 * The only difference between the Project Prompt and each Per-Part Prompt is the final execution line!
 */
/**
 * Derives a contextual, isolated diegetic Foley sound effect tailored to the scene's narration and visual action.
 * Enforces natural decay to silence to guarantee zero abrupt audio cuts across scene transitions.
 */
export function deriveContextualSfxCue(
  narrationText: string,
  visualAction?: string,
  sceneIndex?: number,
  totalScenes?: number
): string {
  const text = `${narrationText} ${visualAction ?? ""}`.toLowerCase();

  // 1. Horror / misteri / menyeramkan / mencekam
  if (
    text.includes("horor") ||
    text.includes("seram") ||
    text.includes("mencekam") ||
    text.includes("takut") ||
    text.includes("hantu") ||
    text.includes("gelap") ||
    text.includes("merinding") ||
    text.includes("huuu")
  ) {
    return "Desau hembusan angin misterius pendek 'whoosh' bernada rendah halus (1.5 detik), lalu memudar senyap ke hening sebelum adegan selesai.";
  }

  // 2. Tidur / malam / kasur / lelah / insomnia / subuh / jam biologis
  if (
    text.includes("tidur") ||
    text.includes("malam") ||
    text.includes("kasur") ||
    text.includes("ngantuk") ||
    text.includes("jam biologis") ||
    text.includes("subuh") ||
    text.includes("lelap") ||
    text.includes("istirahat")
  ) {
    return "Bunyi detik jarum jam dinding hening 'tik... tok...' perlahan (1.5 detik) dengan jeda senyap, tanpa musik latar.";
  }

  // 3. Otak / dopamine / ide / stres / psikologis / balas dendam / solusi
  if (
    text.includes("dopamine") ||
    text.includes("otak") ||
    text.includes("balas dendam") ||
    text.includes("psikologis") ||
    text.includes("solusi") ||
    text.includes("sadar") ||
    text.includes("tau") ||
    text.includes("ide") ||
    text.includes("stres")
  ) {
    return "Denting penanda ide lembut dan bersih 'ting' (1 detik) bergaung halus, lalu langsung hening.";
  }

  // 4. Kertas lecek / sobek / lipat / tekstur fisik kertas origami
  if (
    text.includes("sobek") ||
    text.includes("lecek") ||
    text.includes("kertas") ||
    text.includes("lipat") ||
    text.includes("tubuh lo kayak") ||
    text.includes("rusak") ||
    text.includes("patah")
  ) {
    return "Bunyi renyah lipatan kertas origami berderit dan tekstur kertas bergesekan tajam (1-2 detik), lalu hening.";
  }

  // 5. Gadget / handphone / scrolling / layar / transisi
  if (
    text.includes("gadget") ||
    text.includes("scrolling") ||
    text.includes("layar") ||
    text.includes("hp") ||
    text.includes("notif") ||
    text.includes("video ini")
  ) {
    return "Bunyi ketukan halus ujung jari pada permukaan kertas (tactile paper tap) dan gesekan lembut (1 detik), fade out ke senyap.";
  }

  // 6. Pertanyaan / CTA / ajakan komentar di scene akhir
  if (
    (totalScenes && sceneIndex === totalScenes) ||
    text.includes("komentar") ||
    text.includes("gimana") ||
    text.includes("menurut lo") ||
    text.includes("coba tulis")
  ) {
    return "Dua ketukan kayu lembut (woodblock pop) ramah penutup (1 detik), lalu senyap total.";
  }

  // 7. Hook / scene 1 pembuka fakta penasaran
  if (sceneIndex === 1 || text.includes("pernah") || text.includes("kenapa")) {
    return "Swish gesekan kertas origami membuka diorama (tactile paper slide 1.5 detik), disusul keheningan fokus.";
  }

  // Default: Origami diegetic Foley
  return "Gemerisik lembut lipatan kertas origami bergerak perlahan (tactile paper fold 1.5 detik), lalu mereda senyap sebelum akhir adegan.";
}

export function buildProjectAndPartPrompts(
  input: PromptBuildInput
): ProjectAndPartPromptsResult {
  const { settings, content, scenes, characterRosterSummary } = input;
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);

  const characterLine = characterRosterSummary?.trim()
    ? characterRosterSummary.trim()
    : `MAIN CHARACTER REFERENCE: ${settings.characterDescription}`;

  const transcriptLines = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    return `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] : ${sc.narrationText}`;
  });

  const detailedPartBlocks = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    const durationSec = Math.max(1, Math.min(10, endSec - startSec || Math.round(sc.durationMs / 1000)));
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      sc.expectedFilename ||
      `${content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;
    const sfxCue =
      sc.sfxCue ||
      deriveContextualSfxCue(
        sc.narrationText,
        sc.visualAction,
        sc.sceneIndex,
        sorted.length
      );

    return [
      `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${durationSec}s • Nama Output File: Bagian ${sc.sceneIndex} • Target File: ${expectedFilename}) : ${sc.narrationText}`,
      `  - Visual Origami Action: ${sc.visualAction}. (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO text/subtitles).`,
      `  - Efek Suara (Diegetic SFX Cue): ${sfxCue}`,
      `  - Aturan Transisi Audio Mulus: Efek suara berdurasi singkat (1-2 detik) di tengah adegan dan WAJIB memudar senyap (fade to silence) sebelum detik ke-${durationSec}. DILARANG ada musik latar (NO BGM), suara vokal/bicara, atau dengung terus-menerus agar sambungan video berikutnya mulus tanpa audio terpotong.`,
    ].join("\n");
  });

  const baseUnifiedPrompt = [
    `=== PROJECT VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
    `Content Code : ${content.contentCode}`,
    `Judul Konten : ${content.title}`,
    `Topik        : ${content.topic}`,
    `Format Video : Vertical ${settings.outputAspectRatio} (${settings.outputWidth}x${settings.outputHeight}) • Maksimal 10 Detik per Bagian`,
    ``,
    `[ATURAN PENAMAAN OUTPUT WAJIB]`,
    `- Setiap video yang dihasilkan WAJIB dinamai dan diberi label secara berurutan: "Bagian 1", "Bagian 2", ... hingga "Bagian ${sorted.length}".`,
    `- JANGAN beri nama acak atau deskriptif saja. Cantumkan selalu kata "Bagian [Nomor]" agar urutan file tidak tertukar saat diunduh.`,
    ``,
    `[ATURAN VISUAL & KARAKTER WAJIB]`,
    `- Gaya Visual: ${settings.visualStyleGuide}`,
    `- ${characterLine}`,
    `- Aturan Ketat: 100% dunia lipatan kertas origami stop-motion (handmade folded matte paper). DILARANG menampilkan subtitle, teks di layar, huruf, watermark, atau manusia/objek realistis. (NO subtitles, NO text).`,
    `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian dari Bagian 1 hingga Bagian ${sorted.length}.`,
    ``,
    `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB — ZERO TRANSITION CUT-OFF]`,
    `- DILARANG KERAS ADA BACKGROUND MUSIC (NO CONTINUOUS BGM / NO AMBIENT MUSIC): Tidak boleh ada instrumen musik, beat, drone, melodi, atau ritme latar yang terus-menerus mengisi video klip.`,
    `- DILARANG ADA SUARA BICARA (NO SPEECH / NO DIALOGUE): Karakter origami Obim dan objek lainnya dilarang mengeluarkan suara kata/bicara/vokal (narasi diisi terpisah melalui dubbing suara narator).`,
    `- HANYA EFEK SUARA DIEGETIK PENDEK (ISOLATED FOLEY SFX): Hanya sertakan efek suara nyata kontekstual berdurasi 1-2 detik yang selaras dengan panduan Efek Suara pada setiap bagian (contoh: bunyi gemerisik lipatan kertas origami, denting ide singkat, desau horor pendek "huuu", bunyi detik jam dinding hening, dll).`,
    `- ATURAN KEHENINGAN DI AWAL & AKHIR (MANDATORY SILENCE AT HEAD & TAIL): Efek suara harus mulai sedikit setelah awal adegan (+0.3s) dan HARUS selesai serta memudar sempurna menjadi hening (complete fade-out to silence) minimal 0.5 detik sebelum durasi klip berakhir.`,
    `- TUJUAN TRANSISI SINKRON: Dengan aturan jeda senyap ini, saat seluruh bagian video digabungkan secara berurutan, TIDAK AKAN ADA suara latar yang terpotong secara kasar/patah di antara pergantian scene. Konten tetap interaktif dengan aksen suara yang hidup tanpa merusak transisi.`,
    ``,
    `[DAFTAR TRANSKRIP & BAGIAN SCENE (MAKSIMAL 10 DETIK PER BAGIAN)]`,
    ...detailedPartBlocks,
  ].join("\n");

  const projectPrompt = `${baseUnifiedPrompt}\n\nINSTRUKSI EKSEKUSI: Kerjakan semua bagian secara berurutan dan namai setiap output dengan "Bagian 1", "Bagian 2", dst.`;

  const partPrompts = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    const durationSec = Math.max(1, Math.min(10, endSec - startSec || Math.round(sc.durationMs / 1000)));
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      sc.expectedFilename ||
      `${content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    const continuityBlock =
      sc.sceneIndex > 1
        ? `\nCONTINUITY FROM SCENE #${sc.sceneIndex - 1}: Pertahankan kontinuitas pose karakter, pencahayaan lipatan kertas, dan latar dari scene sebelumnya.`
        : "";

    return {
      partIndex: sc.sceneIndex,
      startSec,
      endSec,
      durationSec,
      narrationText: sc.narrationText,
      expectedFilename,
      promptText: `${baseUnifiedPrompt}${continuityBlock}\n\nINSTRUKSI EKSEKUSI: Kerjakan bagian ${sc.sceneIndex} saja dan namai output dengan "Bagian ${sc.sceneIndex}".`,
    };
  });

  return {
    transcriptFormattedText: transcriptLines.join("\n\n"),
    projectPrompt,
    partPrompts,
  };
}

/**
 * Generates deterministic, copy-ready origami paper stop-motion video prompts for each scene.
 * Each scene's `promptText` is the unified project prompt ending with `INSTRUKSI EKSEKUSI: Kerjakan bagian X saja.`
 */
export function buildPromptsForScenes(
  input: PromptBuildInput
): SceneRecord[] {
  const { scenes } = input;
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const now = new Date().toISOString();
  const built = buildProjectAndPartPrompts(input);

  return sorted.map((sc, idx) => {
    const part = built.partPrompts[idx];
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      part?.expectedFilename ||
      `${input.content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    const sfxCue =
      sc.sfxCue ||
      deriveContextualSfxCue(
        sc.narrationText,
        sc.visualAction,
        sc.sceneIndex,
        sorted.length
      );

    return {
      ...sc,
      sfxCue,
      expectedFilename,
      promptText: part?.promptText ?? "",
      sceneStatus:
        sc.sceneStatus === "clip_uploaded" || sc.sceneStatus === "validated"
          ? sc.sceneStatus
          : "prompt_ready",
      updatedAt: now,
    };
  });
}

/**
 * Formats the prompt pack as plain text (.txt) with Transcript + Prompt Project + Prompt Per Bagian.
 */
export function exportPromptPackAsTxt(
  content: Pick<ContentItemRecord, "contentCode" | "title" | "topic">,
  scenes: SceneRecord[]
): string {
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const transcriptBlock = sorted
    .map((s) => {
      const startSec = Math.round(s.startMs / 1000);
      const endSec = Math.round(s.endMs / 1000);
      return `Bagian ${s.sceneIndex} [${startSec}-${endSec}] : ${s.narrationText}`;
    })
    .join("\n\n");

  const firstPrompt = sorted[0]?.promptText || "";
  const projectPrompt = firstPrompt
    ? firstPrompt.replace(
        /INSTRUKSI EKSEKUSI:\s*Kerjakan bagian \d+ saja\.$/i,
        "INSTRUKSI EKSEKUSI: Kerjakan semua bagian."
      )
    : "";

  const header = [
    `================================================================================`,
    `CERITAOBIM STUDIO — TRANSKRIP AUDIO & PROMPT PROJECT / PER BAGIAN (Semi-Manual Google Flow)`,
    `Content ID : ${content.contentCode}`,
    `Title      : ${content.title}`,
    `Topic      : ${content.topic}`,
    `Total Bagian: ${sorted.length} Bagian (Maksimal 10 Detik / Bagian)`,
    `================================================================================`,
    ``,
    `1. TRANSKRIP AUDIO DENGAN TIMESTAMP (PER <= 10 DETIK):`,
    `--------------------------------------------------------------------------------`,
    transcriptBlock,
    ``,
    `================================================================================`,
    `2. PROMPT PROJECT (KESELURUHAN — KERJAKAN SEMUA BAGIAN):`,
    `================================================================================`,
    projectPrompt,
    ``,
  ].join("\n");

  const blocks = sorted
    .map((s) => {
      const startSec = Math.round(s.startMs / 1000);
      const endSec = Math.round(s.endMs / 1000);
      return [
        `================================================================================`,
        `3.${s.sceneIndex} PROMPT PER BAGIAN — BAGIAN ${s.sceneIndex} [${startSec}-${endSec}] (Target: ${s.expectedFilename})`,
        `================================================================================`,
        s.promptText,
        ``,
      ].join("\n");
    })
    .join("\n");

  return `${header}\n${blocks}`;
}

/**
 * Formats the prompt pack as CSV string.
 */
export function exportPromptPackAsCsv(
  content: Pick<ContentItemRecord, "contentCode" | "title">,
  scenes: SceneRecord[]
): string {
  const rows = scenes.map((s) => ({
    "Content ID": content.contentCode,
    "Scene Index": s.sceneIndex,
    "Expected Filename": s.expectedFilename,
    "Start (ms)": s.startMs,
    "End (ms)": s.endMs,
    "Duration (sec)": Number((s.durationMs / 1000).toFixed(2)),
    "Timestamp Status": s.timestampStatus.toUpperCase(),
    "Narration Segment": s.narrationText,
    "Visual Action": s.visualAction,
    "Camera Direction": s.cameraDirection,
    "Continuity Notes": s.continuityNotes,
    Prompt: s.promptText,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  return XLSX.utils.sheet_to_csv(sheet);
}

/**
 * Formats the prompt pack as an XLSX buffer.
 */
export function exportPromptPackAsXlsxBuffer(
  content: Pick<ContentItemRecord, "contentCode" | "title">,
  scenes: SceneRecord[]
): Buffer {
  const rows = scenes.map((s) => ({
    "Content ID": content.contentCode,
    "Scene Index": s.sceneIndex,
    "Expected Filename": s.expectedFilename,
    "Start (ms)": s.startMs,
    "End (ms)": s.endMs,
    "Duration (sec)": Number((s.durationMs / 1000).toFixed(2)),
    "Timestamp Status": s.timestampStatus.toUpperCase(),
    "Narration Segment": s.narrationText,
    "Visual Action": s.visualAction,
    "Camera Direction": s.cameraDirection,
    "Continuity Notes": s.continuityNotes,
    Prompt: s.promptText,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "ScenePrompts");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
