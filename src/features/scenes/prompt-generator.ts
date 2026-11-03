import * as XLSX from "xlsx";
import type {
  ContentItemRecord,
  ProjectSettingsSummary,
  SceneRecord,
} from "@/types/domain";
import { deriveTopicSceneEntity } from "./topic-entity-enricher";

export interface PromptBuildInput {
  settings: ProjectSettingsSummary;
  content: Pick<ContentItemRecord, "contentCode" | "title" | "topic"> &
    Partial<Pick<ContentItemRecord, "category" | "programName">>;
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

export function deriveHeadlineQuestion(title: string, topic?: string): string {
  const cleanTitle = title.trim();
  if (cleanTitle.endsWith("?")) {
    return cleanTitle;
  }
  if (/^(kenapa|mengapa|bagaimana|apa|benarkah|siapa|tahukah)/i.test(cleanTitle)) {
    return `${cleanTitle}?`;
  }
  if (topic && /^(kenapa|mengapa|bagaimana|apa|benarkah|siapa|tahukah)/i.test(topic.trim())) {
    return topic.trim().endsWith("?") ? topic.trim() : `${topic.trim()}?`;
  }
  return `Kenapa ${cleanTitle}?`;
}

export function buildProjectAndPartPrompts(
  input: PromptBuildInput
): ProjectAndPartPromptsResult {
  const { settings, content, scenes, characterRosterSummary } = input;
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const headlineQuestion = deriveHeadlineQuestion(content.title, content.topic);

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
    const rawDur = Math.max(1, endSec - startSec || Math.round(sc.durationMs / 1000));
    // Strictly map duration to either 10s or 8s for Google Flow Omni 1.1 Flash compatibility
    const flowDurationSec = rawDur >= 9 ? 10 : 8;
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      sc.expectedFilename ||
      `${content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    const entity = deriveTopicSceneEntity({
      contentCode: content.contentCode,
      title: content.title,
      topic: content.topic,
      category: content.category,
      programName: content.programName,
      sceneIndex: sc.sceneIndex,
      totalScenes: sorted.length,
      narrationText: sc.narrationText,
      userVisualAction: sc.visualAction,
    });

    const sfxCue =
      sc.sfxCue ||
      entity.diegeticSfxCue ||
      deriveContextualSfxCue(
        sc.narrationText,
        sc.visualAction,
        sc.sceneIndex,
        sorted.length
      );

    if (sc.sceneIndex === 1) {
      return [
        `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${flowDurationSec}s • [${entity.roleLabel}] • Nama Output File: Bagian ${sc.sceneIndex} • Target File: ${expectedFilename}) : ${sc.narrationText}`,
        `  - Entity Role           : ${entity.roleLabel}`,
        `  - Properti Kertas Topik : ${entity.topicProps.join(", ")}`,
        `  - Pose & Ekspresi Obim  : ${entity.characterStance}`,
        `  - Visual Origami Action : ${entity.enrichedVisualAction}`,
        `  - Lingkungan Diorama    : ${entity.origamiEnvironment}`,
        `  - SPESIFIKASI KINETIC HOOK (DETIK 0-3): Aksi fisik origami langsung di awal (in-media-res)! DILARANG menggunakan papan nama, banner, atau teks kaku. Ciptakan rasa penasaran ekstrem murni lewat pergerakan objek kertas spektakuler, reaksi ekspresi komikal Obim, dan komposisi kamera vertikal 9:16 dinamis.`,
        `  - Aturan Teks: 100% MURNI VISUAL STOP-MOTION KERTAS ORIGAMI (NO text on screen, NO subtitles, NO banners, NO watermark) agar tampak modern, dinamis, dan tidak kaku seperti brosur tua.`,
        `  - Efek Suara (Diegetic SFX Cue): ${sfxCue}`,
        `  - Aturan Transisi Audio Mulus: Efek suara berdurasi singkat (1-2 detik) di tengah adegan dan WAJIB memudar senyap (fade to silence) sebelum detik ke-${flowDurationSec}. DILARANG ada musik latar (NO BGM), suara vokal/bicara, atau dengung terus-menerus agar sambungan video berikutnya mulus tanpa audio terpotong.`,
      ].join("\n");
    }

    return [
      `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${flowDurationSec}s • [${entity.roleLabel}] • Nama Output File: Bagian ${sc.sceneIndex} • Target File: ${expectedFilename}) : ${sc.narrationText}`,
      `  - Entity Role           : ${entity.roleLabel}`,
      `  - Properti Kertas Topik : ${entity.topicProps.join(", ")}`,
      `  - Pose & Ekspresi Obim  : ${entity.characterStance}`,
      `  - Visual Origami Action : ${entity.enrichedVisualAction} (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO text/subtitles).`,
      `  - Lingkungan Diorama    : ${entity.origamiEnvironment}`,
      `  - Efek Suara (Diegetic SFX Cue): ${sfxCue}`,
      `  - Aturan Transisi Audio Mulus: Efek suara berdurasi singkat (1-2 detik) di tengah adegan dan WAJIB memudar senyap (fade to silence) sebelum detik ke-${flowDurationSec}. DILARANG ada musik latar (NO BGM), suara vokal/bicara, atau dengung terus-menerus agar sambungan video berikutnya mulus tanpa audio terpotong.`,
    ].join("\n");
  });

  const safeTitle = content.title
    .replace(/[?:\\/*"<>|]/g, "")
    .trim()
    .toUpperCase();

  const baseUnifiedPrompt = [
    `=== PROJECT VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
    `Content Code : ${content.contentCode}`,
    `Judul Konten : ${content.title}`,
    `Topik        : ${content.topic}`,
    `Format Video : Vertical ${settings.outputAspectRatio} (${settings.outputWidth}x${settings.outputHeight}) Stop-Motion Origami Kertas (Model: Omni 1.1 Flash)`,
    ``,
    `[ATURAN PENAMAAN OUTPUT WAJIB]`,
    `- Setiap video yang dihasilkan WAJIB dinamai dan diberi label sesuai judul dan bagian: "${safeTitle} - Bagian [Nomor]" (contoh: "${safeTitle} - Bagian 1", "${safeTitle} - Bagian 2", ... hingga "${safeTitle} - Bagian ${sorted.length}").`,
    `- DILARANG KERAS memberi nama acak atau deskriptif saja. Nama output HARUS selalu persis berformat: "${safeTitle} - Bagian [Nomor]".`,
    ``,
    `[ATURAN MODEL AI & DURASI WAJIB — OMNI 1.1 FLASH]`,
    `- Model AI Video: WAJIB menggunakan Omni 1.1 Flash (mendukung durasi resmi 10 detik dan 8 detik).`,
    `- Durasi Output: Setiap video memiliki durasi resmi 10 detik (atau 8 detik pada adegan penutup).`,
    `- Kelanjutan Visual: Jika ucapan narasi selesai lebih awal dari durasi klip, karakter origami tetap bergerak dan berpose natural hingga durasi video selesai.`,
    ``,
    `[ATURAN TEMPO TINGGI & ANTI-SLOW MOTION — RETENSI TINGGI 9:16]`,
    `- ZERO SLOW-MOTION & ZERO LAZY DRIFT: Video DILARANG KERAS bergerak lambat, malas, atau melayang santai yang membuat penonton scroll sebelum video selesai!`,
    `- HIGH-SPEED CRISP STOP-MOTION: Seluruh objek origami harus bergerak lincah, berkecepatan tinggi, dan berenergi dengan animasi snap-motion lipatan kertas yang meletup sigap (crisp, fast-paced tactile pop-up folding).`,
    `- DYNAMIC CAMERA IN-MOTION: Kamera vertikal 9:16 WAJIB aktif bergerak (fast snap-zoom in, macro dolly-in, whip-pan transisi kilat, dynamic tracking) dengan perubahan fokus visual cepat setiap 1.5 detik.`,
    `- DETIK 0-1.3 INSTANT HOOK: Khusus Bagian 1, frame pertama detik 0.0 WAJIB langsung menghentak dengan kejutan aksi fisik origami ke arah layar untuk mengunci perhatian penonton sejak detik pertama!`,
    ``,
    `[ATURAN VISUAL & KARAKTER WAJIB — 100% BEBAS TEKS]`,
    `- Gaya Visual: ${settings.visualStyleGuide}`,
    `- ${characterLine}`,
    `- High-Impact Visual Hook (Bagian 1): Bagian 1 adalah klip video kinetik pembuka yang langsung menampilkan aksi fisik origami ekstrem (in-media-res) dan ekspresi komikal Obim. DILARANG menggunakan papan nama/banner/teks kaku di layar agar video tampak modern dan menghentikan scroll penonton.`,
    `- Aturan Bebas Teks: 100% dunia lipatan kertas origami stop-motion murni (handmade folded matte paper). DILARANG menampilkan subtitle, teks di layar, huruf, watermark, banner bertuliskan, atau manusia/objek realistis (NO subtitles, NO text on screen).`,
    `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian dari Bagian 1 hingga Bagian ${sorted.length}.`,
    ``,
    `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB — ZERO TRANSITION CUT-OFF]`,
    `- DILARANG KERAS ADA BACKGROUND MUSIC (NO CONTINUOUS BGM / NO AMBIENT MUSIC): Tidak boleh ada instrumen musik, beat, drone, melodi, atau ritme latar yang terus-menerus mengisi video klip.`,
    `- DILARANG ADA SUARA BICARA (NO SPEECH / NO DIALOGUE): Karakter origami Obim dan objek lainnya dilarang mengeluarkan suara kata/bicara/vokal (narasi diisi terpisah melalui dubbing suara narator).`,
    `- HANYA EFEK SUARA DIEGETIK PENDEK (ISOLATED FOLEY SFX): Hanya sertakan efek suara nyata kontekstual berdurasi 1-2 detik yang selaras dengan panduan Efek Suara pada setiap bagian (contoh: bunyi tebasan kertas cepat, gemerisik lipatan kertas origami, denting ide singkat, desau horor pendek, dll).`,
    `- ATURAN KEHENINGAN DI AWAL & AKHIR (MANDATORY SILENCE AT HEAD & TAIL): Efek suara harus mulai sedikit setelah awal adegan (+0.3s) dan HARUS selesai serta memudar sempurna menjadi hening (complete fade-out to silence) minimal 0.5 detik sebelum durasi klip berakhir.`,
    `- TUJUAN TRANSISI SINKRON: Dengan aturan jeda senyap ini, saat seluruh bagian video digabungkan secara berurutan, TIDAK AKAN ADA suara latar yang terpotong secara kasar/patah di antara pergantian scene. Konten tetap interaktif dengan aksen suara yang hidup tanpa merusak transisi.`,
    ``,
    `[DAFTAR TRANSKRIP & BAGIAN SCENE (10 DETIK / 8 DETIK PER BAGIAN)]`,
    ...detailedPartBlocks,
  ].join("\n");

  const projectPrompt = `${baseUnifiedPrompt}\n\nINSTRUKSI EKSEKUSI: Kerjakan semua bagian secara berurutan menggunakan model Omni 1.1 Flash (9:16 vertikal) dan namai setiap output dengan "${safeTitle} - Bagian 1", "${safeTitle} - Bagian 2", dst.`;

  const partPrompts = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    const rawDur = Math.max(1, endSec - startSec || Math.round(sc.durationMs / 1000));
    const durationSec = rawDur >= 9 ? 10 : 8;
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      sc.expectedFilename ||
      `${content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    const continuityBlock =
      sc.sceneIndex > 1
        ? `\nCONTINUITY FROM SCENE #${sc.sceneIndex - 1}: Pertahankan kontinuitas pose karakter, pencahayaan lipatan kertas, dan latar dari scene sebelumnya.`
        : "";

    const outputLabel = `${safeTitle} - Bagian ${sc.sceneIndex}`;
    const partExecution =
      sc.sceneIndex === 1
        ? `Kerjakan bagian 1 (HIGH-IMPACT KINETIC HOOK) saja menggunakan model Omni 1.1 Flash (9:16 vertikal) berdurasi ${durationSec} detik dan namai output dengan "${outputLabel}". Pastikan berupa KLIP VIDEO aksi kinetik stop-motion kertas origami yang sangat memikat di detik pertama (NO banner, NO text, NO subtitles).`
        : `Kerjakan bagian ${sc.sceneIndex} saja menggunakan model Omni 1.1 Flash (9:16 vertikal) berdurasi ${durationSec} detik dan namai output dengan "${outputLabel}". (NO subtitles, NO text).`;

    return {
      partIndex: sc.sceneIndex,
      startSec,
      endSec,
      durationSec,
      narrationText: sc.narrationText,
      expectedFilename,
      promptText: `${baseUnifiedPrompt}${continuityBlock}\n\nINSTRUKSI EKSEKUSI: ${partExecution}`,
    };
  });

  return {
    transcriptFormattedText: transcriptLines.join("\n\n"),
    projectPrompt,
    partPrompts,
  };
}

/**
 * Builds a single unified prompt to instruct Google Flow to generate a batch of scenes
 * (e.g. Bagian 1 s/d 4) at once, with mandatory naming "[JUDUL] - Bagian [X]" for each video.
 */
export function buildMultiScenePrompt(
  input: PromptBuildInput,
  targetSceneIndices: number[]
): string {
  const { settings, content, scenes, characterRosterSummary } = input;
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const targetScenes = sorted.filter((s) => targetSceneIndices.includes(s.sceneIndex));
  if (targetScenes.length === 0) return "";

  const safeTitle = content.title.replace(/[?:\\/*"<>|]/g, "").trim().toUpperCase();
  const headlineQuestion = deriveHeadlineQuestion(content.title, content.topic);

  const characterLine = characterRosterSummary?.trim()
    ? characterRosterSummary.trim()
    : `MAIN CHARACTER REFERENCE: ${settings.characterDescription}`;

  const targetDescriptions = targetScenes.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    const rawDur = Math.max(1, endSec - startSec || Math.round(sc.durationMs / 1000));
    // Strictly map duration to either 10s or 8s for Google Flow Omni 1.1 Flash compatibility
    const durationSec = rawDur >= 9 ? 10 : 8;
    const outputLabel = `${safeTitle} - Bagian ${sc.sceneIndex}`;

    const entity = deriveTopicSceneEntity({
      contentCode: content.contentCode,
      title: content.title,
      topic: content.topic,
      category: content.category,
      programName: content.programName,
      sceneIndex: sc.sceneIndex,
      totalScenes: sorted.length,
      narrationText: sc.narrationText,
      userVisualAction: sc.visualAction,
    });

    if (sc.sceneIndex === 1) {
      return [
        `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${durationSec}s • [${entity.roleLabel}] • Nama Output: "${outputLabel}") : ${sc.narrationText}`,
        `  - Peran Visual Entity   : ${entity.roleLabel}`,
        `  - Properti Kertas Topik : ${entity.topicProps.join(", ")}`,
        `  - Pose & Ekspresi Obim  : ${entity.characterStance}`,
        `  - Visual Origami Action : ${entity.enrichedVisualAction}`,
        `  - Lingkungan Diorama    : ${entity.origamiEnvironment}`,
        `  - SPESIFIKASI KINETIC HOOK (DETIK 0-3): Aksi fisik origami langsung di awal (in-media-res)! DILARANG menggunakan papan nama, banner, atau teks kaku. Ciptakan rasa penasaran ekstrem murni lewat pergerakan objek kertas spektakuler, reaksi ekspresi komikal Obim, dan komposisi kamera vertikal 9:16 dinamis. NO subtitles, NO text on screen.`,
      ].join("\n");
    }

    return [
      `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${durationSec}s • [${entity.roleLabel}] • Nama Output: "${outputLabel}") : ${sc.narrationText}`,
      `  - Peran Visual Entity   : ${entity.roleLabel}`,
      `  - Properti Kertas Topik : ${entity.topicProps.join(", ")}`,
      `  - Pose & Ekspresi Obim  : ${entity.characterStance}`,
      `  - Visual Origami Action : ${entity.enrichedVisualAction} (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO subtitles, NO text on screen).`,
      `  - Lingkungan Diorama    : ${entity.origamiEnvironment}`,
    ].join("\n");
  });

  const partNamesList = targetScenes.map((sc) => `Bagian ${sc.sceneIndex}`).join(", ");
  const outputRequirements = targetScenes
    .map((sc, i) => `  ${i + 1}. Output ${sc.sceneIndex}: "${safeTitle} - Bagian ${sc.sceneIndex}"`)
    .join("\n");

  return [
    `=== BATCH VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
    `Content Code : ${content.contentCode}`,
    `Judul Konten : ${content.title}`,
    `Topik        : ${content.topic}`,
    `Format Video : Vertical ${settings.outputAspectRatio} (${settings.outputWidth}x${settings.outputHeight}) (Model: Omni 1.1 Flash)`,
    ``,
    `[ATURAN PENAMAAN OUTPUT WAJIB]`,
    `- Setiap video yang dihasilkan WAJIB dinamai dan diberi label persis: "${safeTitle} - Bagian [Nomor]".`,
    `- DILARANG KERAS memberi nama acak atau deskriptif saja. Cantumkan selalu "${safeTitle} - Bagian [Nomor]" agar urutan file tidak tertukar saat diunduh.`,
    ``,
    `[ATURAN MODEL AI & DURASI WAJIB — OMNI 1.1 FLASH]`,
    `- Model AI Video: WAJIB menggunakan Omni 1.1 Flash (mendukung durasi resmi 10 detik dan 8 detik).`,
    `- Durasi Output: Setiap video memiliki durasi resmi 10 detik (atau 8 detik pada adegan penutup).`,
    `- Kelanjutan Visual: Jika ucapan narasi selesai lebih awal dari durasi klip, karakter origami tetap bergerak dan berpose natural hingga durasi video selesai.`,
    ``,
    `[ATURAN TEMPO TINGGI & ANTI-SLOW MOTION — RETENSI TINGGI 9:16]`,
    `- ZERO SLOW-MOTION & ZERO LAZY DRIFT: Video DILARANG KERAS bergerak lambat, malas, atau melayang santai yang membuat penonton scroll sebelum video selesai!`,
    `- HIGH-SPEED CRISP STOP-MOTION: Seluruh objek origami harus bergerak lincah, berkecepatan tinggi, dan berenergi dengan animasi snap-motion lipatan kertas yang meletup sigap (crisp, fast-paced tactile pop-up folding).`,
    `- DYNAMIC CAMERA IN-MOTION: Kamera vertikal 9:16 WAJIB aktif bergerak (fast snap-zoom in, macro dolly-in, whip-pan transisi kilat, dynamic tracking) dengan perubahan fokus visual cepat setiap 1.5 detik.`,
    `- DETIK 0-1.3 INSTANT HOOK: Khusus Bagian 1, frame pertama detik 0.0 WAJIB langsung menghentak dengan kejutan aksi fisik origami ke arah layar untuk mengunci perhatian penonton sejak detik pertama!`,
    ``,
    `[ATURAN VISUAL & KARAKTER WAJIB — 100% BEBAS TEKS]`,
    `- Gaya Visual: ${settings.visualStyleGuide}`,
    `- ${characterLine}`,
    `- High-Impact Visual Hook (Bagian 1): Bagian 1 WAJIB berupa KLIP VIDEO kinetik vertikal 9:16 (bukan gambar diam) dengan aksi origami spektakuler dan ekspresi Obim yang menghentikan scroll. DILARANG menggunakan papan nama, banner, teks di layar, atau subtitle.`,
    `- Aturan Bebas Teks: 100% dunia lipatan kertas origami stop-motion murni (handmade folded matte paper). DILARANG menampilkan subtitle, teks di layar, huruf, watermark, banner bertuliskan, atau manusia/objek realistis (NO subtitles, NO text on screen).`,
    `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian secara berurutan.`,
    ``,
    `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB]`,
    `- NO BGM, NO SPEECH: DILARANG ada background music atau suara bicara/kata. Hanya efek suara nyata kontekstual singkat (1-2 detik) di tengah dan senyap di awal/akhir adegan agar transisi mulus.`,
    ``,
    `[DAFTAR ${targetScenes.length} BAGIAN YANG HARUS DIKERJAKAN PADA SESI INI]`,
    ...targetDescriptions,
    ``,
    `[INSTRUKSI EKSEKUSI WAJIB — KERJAKAN ${targetScenes.length} BAGIAN SEKALIGUS]`,
    `Kerjakan ${targetScenes.length} bagian di atas (${partNamesList}) SEKALIGUS menggunakan model Omni 1.1 Flash dalam bentuk ${targetScenes.length} KLIP VIDEO vertikal 9:16 stop-motion origami kertas.`,
    `Setiap klip video yang dihasilkan WAJIB dinamai dan diberi label PERSIS sebagai berikut:`,
    outputRequirements,
    ``,
    `Gunakan aset referensi origami berikut sebagai karakter pemeran utama:`,
  ].join("\n");
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
  const headlineQuestion = deriveHeadlineQuestion(input.content.title, input.content.topic);

  return sorted.map((sc, idx) => {
    const part = built.partPrompts[idx];
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      part?.expectedFilename ||
      `${input.content.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    const entity = deriveTopicSceneEntity({
      contentCode: input.content.contentCode,
      title: input.content.title,
      topic: input.content.topic,
      category: input.content.category,
      programName: input.content.programName,
      sceneIndex: sc.sceneIndex,
      totalScenes: sorted.length,
      narrationText: sc.narrationText,
      userVisualAction: sc.visualAction,
    });

    const sfxCue =
      sc.sfxCue ||
      entity.diegeticSfxCue ||
      deriveContextualSfxCue(
        sc.narrationText,
        sc.visualAction,
        sc.sceneIndex,
        sorted.length
      );

    return {
      ...sc,
      visualAction: entity.enrichedVisualAction,
      sfxCue,
      expectedFilename,
      entityAttributes: {
        role: entity.role,
        roleLabel: entity.roleLabel,
        topicProps: entity.topicProps,
        characterStance: entity.characterStance,
        origamiEnvironment: entity.origamiEnvironment,
        actionChoreography: entity.actionChoreography,
        coverBannerText: sc.sceneIndex === 1 ? headlineQuestion.toUpperCase() : undefined,
      },
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
