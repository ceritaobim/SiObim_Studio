import fs from "fs";
import path from "path";
import {
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
  runContentVideoAssembly,
  saveUploadedSceneClip,
} from "@/lib/db/repository";
import { evaluateClipCompleteness } from "@/features/video-generation/clip-matcher";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { ContentItemRecord, SceneRecord } from "@/types/domain";

export interface MigrationOptions {
  ownerId?: string;
  userDownloadsDir?: string;
  cleanClipsDir?: string;
  duplicateClipsDir?: string;
  unmatchedClipsDir?: string;
  storePath?: string;
  forceLocalStore?: boolean;
  skipIngest?: boolean;
  skipAssembly?: boolean;
  onProgress?: (message: string) => void;
}

export interface Stage1Result {
  originalFilename: string;
  destinationPath: string;
  contentCode: string;
  sceneIndex: number;
}

export interface Stage2DetectedResult {
  originalFilename: string;
  renamedFilename: string;
  destinationPath: string;
  contentCode: string;
  sceneIndex: number;
  reason: string;
}

export interface Stage2UnmatchedResult {
  filename: string;
  reason: string;
}

export interface Stage3DuplicateResult {
  contentCode: string;
  sceneIndex: number;
  keptFile: string;
  duplicateFile: string;
  archivedToPath: string;
  reason: string;
}

export interface AssemblySuccessResult {
  contentCode: string;
  title: string;
  finalVideoPath: string;
}

export interface ClipMigrationReport {
  ok: boolean;
  timestamp: string;
  scannedCount: number;
  stage1Moved: Stage1Result[];
  stage2Detected: Stage2DetectedResult[];
  stage2Unmatched: Stage2UnmatchedResult[];
  stage3Duplicates: Stage3DuplicateResult[];
  stage4IngestedCount: number;
  stage4AssembledVideos: AssemblySuccessResult[];
  summaryMessage: string;
}

const STOPWORDS = new Set([
  "papercraft", "paper", "origami", "boy", "the", "and", "for", "with", "from",
  "clip", "scene", "video", "yang", "bisa", "kita", "hari", "kali", "oleh",
  "pada", "akan", "dari", "pantai", "laut", "hutan", "jalan", "foto", "gambar",
  "dan", "ini", "itu", "atau", "saat", "juga", "kamu", "saya", "jadi", "karena"
]);

/**
 * Checks if a filename already conforms strictly to studio naming standards:
 * - `CO-2026-XXX_BAGIAN_Y...`
 * - `CO-2026-XXX_SCENE_YYY...`
 * - `CO-2026-XXX - [Judul] - Bagian Y.mp4`
 * - `[seg]_[week]_[content]_[scene].mp4` (standard numerical code)
 */
export function isAlreadyStandardNamed(
  filename: string,
  items: ContentItemRecord[]
): { isStandard: boolean; contentCode?: string; sceneIndex?: number } {
  const ext = path.extname(filename).toLowerCase();
  if (ext !== ".mp4" && ext !== ".webm" && ext !== ".mov") {
    return { isStandard: false };
  }

  const base = path.basename(filename, ext);

  // 1. Check CO-2026-XXX pattern with Scene or Bagian
  const codeMatch = base.match(/(CO-\d{4}-\d{3}|CO-\d{3})/i);
  if (codeMatch && codeMatch[1]) {
    const rawCode = codeMatch[1].toUpperCase();
    const item = items.find((i) => i.contentCode.toUpperCase() === rawCode);
    const sceneMatch = base.match(/(?:BAGIAN|SCENE|PART)[_\s-]*0*(\d+)/i);
    if (item && sceneMatch && sceneMatch[1]) {
      return {
        isStandard: true,
        contentCode: item.contentCode,
        sceneIndex: parseInt(sceneMatch[1], 10),
      };
    }
  }

  // 2. Check standard numerical short code: e.g. "1_1_23_1.mp4" or "3_4_25_2.mp4" (NO pzxc and NO xx)
  const numCodeMatch = base.match(/^(\d+)_(\d+)_(\d+)_0*(\d+)$/);
  if (numCodeMatch && numCodeMatch[3] && numCodeMatch[4]) {
    const contentNum = parseInt(numCodeMatch[3], 10);
    const sceneIndex = parseInt(numCodeMatch[4], 10);
    const item = items.find(
      (i) => parseInt(i.contentCode.replace(/\D/g, "").slice(-3), 10) === contentNum
    );
    if (item) {
      return {
        isStandard: true,
        contentCode: item.contentCode,
        sceneIndex,
      };
    }
  }

  // 3. Check "[Judul Konten] - Bagian X.mp4"
  const titlePartMatch = base.match(/^(.+?)\s*-\s*Bagian\s*0*(\d+)$/i);
  if (titlePartMatch && titlePartMatch[1] && titlePartMatch[2]) {
    const cleanTitle = titlePartMatch[1].trim().toLowerCase();
    const sceneIndex = parseInt(titlePartMatch[2], 10);
    const item = items.find((i) => {
      const norm = (i.title || "").toLowerCase().replace(/[?:/*"<>|\\]/g, "").trim();
      return norm === cleanTitle || cleanTitle.includes(norm) || norm.includes(cleanTitle);
    });
    if (item) {
      return {
        isStandard: true,
        contentCode: item.contentCode,
        sceneIndex,
      };
    }
  }

  return { isStandard: false };
}

/**
 * Detects raw/unformatted filenames from Downloads (macro pzxc or Google Flow prompt descriptions)
 * and determines their target content and scene index.
 */
export async function detectRawClipContentAndScene(
  filename: string,
  items: ContentItemRecord[],
  ownerId: string,
  options?: {
    storePath?: string;
    forceLocal?: boolean;
    allScenesGrouped?: Record<string, SceneRecord[]>;
  }
): Promise<{
  matchedItem: ContentItemRecord | null;
  sceneIndex: number | null;
  reason: string;
}> {
  const ext = path.extname(filename).toLowerCase();
  if (ext !== ".mp4" && ext !== ".webm" && ext !== ".mov") {
    return { matchedItem: null, sceneIndex: null, reason: "Bukan file video MP4" };
  }

  const base = path.basename(filename, ext);

  // 1. Detection via pzxc macro pattern: e.g. "pzxc_3_4_23_1xx_6ffc1377.mp4" or "pzxc_3_4_25_2xx_26143444.mp4"
  const pzxcMatch = base.match(/(?:pzxc_)?(\d+)_(\d+)_(\d+)_0*(\d+)(?:xx.*)?$/i);
  if (pzxcMatch && pzxcMatch[3] && pzxcMatch[4]) {
    const contentNum = parseInt(pzxcMatch[3], 10);
    const sceneIndex = parseInt(pzxcMatch[4], 10);
    const item = items.find(
      (i) => parseInt(i.contentCode.replace(/\D/g, "").slice(-3), 10) === contentNum
    );
    if (item) {
      return {
        matchedItem: item,
        sceneIndex,
        reason: `Terdeteksi dari kode makro (${pzxcMatch[0]}) -> Konten ${item.contentCode} Bagian ${sceneIndex}`,
      };
    }
  }

  // 2. Detection via semantic keywords & visual action patterns (Google Flow English prompts)
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[…_.\-]+/g, " ")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const lowerBase = normalizeText(base);

  // Semantic dictionary for known CeritaObim video topics
  const semanticRules: Array<{
    keywords: string[];
    code: string;
    sceneRules?: Array<{ keywords: string[]; scene: number }>;
    defaultScene?: number;
    description: string;
  }> = [
    {
      // CO-2026-010: Nanas Bisa Makan Lidah Lo Balik!
      keywords: [
        "pineapple",
        "nanas",
        "bromelain",
        "enzymes",
        "tongue",
        "devours origami p",
        "eating_origami_pi",
        "origami_pi",
        "molecules_transforming",
        "transforming_fla",
        "enzymes_activating",
      ],
      code: "CO-2026-010",
      sceneRules: [
        {
          keywords: [
            "devours",
            "eating pineapple",
            "eating",
            "melahap",
            "sepotong nanas",
            "origami_pi",
            "eating_origami",
          ],
          scene: 1,
        },
        {
          keywords: [
            "enzymes",
            "activating",
            "tingling",
            "protein",
            "geli",
            "gatal",
            "enzymes_activating",
          ],
          scene: 2,
        },
        {
          keywords: [
            "molecules",
            "transforming",
            "salt",
            "air garam",
            "rendam",
            "transforming_fla",
          ],
          scene: 3,
        },
      ],
      defaultScene: 1,
      description: "Topik Enzim Bromelain Nanas (CO-2026-010)",
    },
    {
      // CO-2026-023: Kenapa Kita Suka Goyang-Goyangin Kaki Pas Duduk?
      keywords: ["legs", "goyang", "kaki", "vibrating", "fidget"],
      code: "CO-2026-023",
      sceneRules: [
        { keywords: ["legs", "desk", "vibrating"], scene: 1 },
        { keywords: ["brain", "signals", "muscles"], scene: 2 },
        { keywords: ["life saver", "button", "screen"], scene: 3 },
      ],
      defaultScene: 1,
      description: "Topik Goyang Kaki (CO-2026-023)",
    },
    {
      // CO-2026-025: Madu Nggak Pernah Basi Ribuan Tahun?
      keywords: ["honey", "madu", "pyramid", "unfolding paper water"],
      code: "CO-2026-025",
      sceneRules: [
        { keywords: ["pyramid", "jar", "golden"], scene: 1 },
        { keywords: ["unfolding paper water", "water", "droplets", "absorbs"], scene: 2 },
        { keywords: ["bees", "rotate", "bright"], scene: 3 },
      ],
      defaultScene: 2,
      description: "Topik Madu / Air (CO-2026-025)",
    },
    {
      // CO-2026-026: Kenapa Kita Merasa Diawasin Pas Sendirian?
      keywords: ["flashlight", "diawasin", "alone", "sendirian", "membeku"],
      code: "CO-2026-026",
      sceneRules: [
        { keywords: ["flashlight", "shining", "dark room", "membeku"], scene: 1 },
        { keywords: ["eyeball", "shadow", "transformasi"], scene: 2 },
        { keywords: ["smile", "camera", "kesimpulan"], scene: 3 },
      ],
      defaultScene: 1,
      description: "Topik Merasa Diawasin (CO-2026-026)",
    },
    {
      // CO-2026-029: Kenapa Kita Susah Berhenti Scroll Sosmed?
      keywords: ["scroll", "sosmed", "dopamine"],
      code: "CO-2026-029",
      sceneRules: [
        { keywords: ["swipe", "thumb", "scroll"], scene: 1 },
        { keywords: ["dopamine", "paper gears", "otak"], scene: 2 },
        { keywords: ["clock", "night", "jam", "berhenti"], scene: 3 },
      ],
      defaultScene: 3,
      description: "Topik Scroll Sosmed (CO-2026-029)",
    },
    {
      // CO-2026-035: Kenapa Lagu Sedih Malah Bikin Nyaman?
      keywords: ["sad song", "lagu sedih", "prolactin"],
      code: "CO-2026-035",
      sceneRules: [
        { keywords: ["earphones", "melancholy", "hujan"], scene: 1 },
        { keywords: ["prolactin", "hormone", "warm", "pelukan"], scene: 2 },
        { keywords: ["peaceful", "smile", "comfort"], scene: 3 },
      ],
      defaultScene: 2,
      description: "Topik Lagu Sedih (CO-2026-035)",
    },
    {
      // CO-2026-041: Kenapa Kita Ketawa Pas Digelitik?
      keywords: ["tickling", "gelitik"],
      code: "CO-2026-041",
      sceneRules: [
        { keywords: ["tickling", "observing tickling", "feather", "bulu"], scene: 1 },
        { keywords: ["hypothalamus", "panic", "reflex"], scene: 2 },
        { keywords: ["social", "bonding", "senyum"], scene: 3 },
      ],
      defaultScene: 1,
      description: "Topik Digelitik Ketawa (CO-2026-041)",
    },
    {
      // CO-2026-042: Paru-Paru Kita Seukuran Lapangan Tenis!
      keywords: ["reacts to lungs", "lungs", "paru"],
      code: "CO-2026-042",
      sceneRules: [
        { keywords: ["breathing", "inhale", "napas"], scene: 1 },
        { keywords: ["reacts to lungs", "lungs", "tennis court", "lapangan"], scene: 2 },
        { keywords: ["alveoli", "oxygen", "luas"], scene: 3 },
      ],
      defaultScene: 2,
      description: "Topik Paru-Paru (CO-2026-042)",
    },
  ];

  for (const rule of semanticRules) {
    const hasAnyKeyword = rule.keywords.some((k) =>
      lowerBase.includes(normalizeText(k))
    );
    if (hasAnyKeyword) {
      const item = items.find((i) => i.contentCode === rule.code);
      if (item) {
        let matchedScene = rule.defaultScene ?? 1;
        if (rule.sceneRules) {
          for (const sr of rule.sceneRules) {
            if (sr.keywords.some((k) => lowerBase.includes(normalizeText(k)))) {
              matchedScene = sr.scene;
              break;
            }
          }
        }
        return {
          matchedItem: item,
          sceneIndex: matchedScene,
          reason: `Pencocokan semantik prompt Flow (${rule.description}) -> Bagian ${matchedScene}`,
        };
      }
    }
  }

  // 3. Dynamic match against scene database transcripts and prompt texts (strict tokens)
  const tokens = lowerBase
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t) && !/^[0-9a-f]{6,}$/.test(t));

  if (tokens.length >= 2) {
    const allScenes =
      options?.allScenesGrouped ||
      (await listAllScenesGroupedByContent(ownerId, {
        storePath: options?.storePath,
        forceLocal: options?.forceLocal,
      }));

    let bestItem: ContentItemRecord | null = null;
    let bestSceneIndex: number | null = null;
    let highestScore = 0;

    for (const item of items) {
      const scenes = allScenes[item.id] || [];
      for (const sc of scenes) {
        const textToSearch = `${item.title} ${item.topic} ${sc.visualAction || ""} ${sc.promptText || ""}`.toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (textToSearch.includes(token)) score++;
        }
        if (score > highestScore && score >= 3) {
          highestScore = score;
          bestItem = item;
          bestSceneIndex = sc.sceneIndex;
        }
      }
    }

    if (bestItem && bestSceneIndex !== null) {
      return {
        matchedItem: bestItem,
        sceneIndex: bestSceneIndex,
        reason: `Skor kata kunci transkrip (${highestScore} kecocokan: "${tokens.slice(0, 3).join(', ')}") -> ${bestItem.contentCode} Bagian ${bestSceneIndex}`,
      };
    }
  }

  return {
    matchedItem: null,
    sceneIndex: null,
    reason: "Nama file tidak cocok dengan pola makro maupun kata kunci konten aktif.",
  };
}

/**
 * Builds the canonical clean filename for a scene clip.
 * Format: `CO-2026-XXX_BAGIAN_Y - [Judul].mp4`
 */
export function buildCanonicalClipFilename(
  content: ContentItemRecord,
  sceneIndex: number
): string {
  const safeTitle = (content.title || "")
    .replace(/[?:/*"<>|\\]/g, "")
    .trim();
  return `${content.contentCode}_BAGIAN_${sceneIndex} - ${safeTitle}.mp4`;
}

/**
 * Executes the complete 4-stage migration:
 * 1. Pindahkan file yang sudah sesuai format dari Downloads ke folder sementara.
 * 2. Deteksi file .mp4 yang tersisa di Downloads, rename ke format resmi, dan pindahkan ke folder sementara.
 *    (File yang tidak terdeteksi dibiarkan di Downloads).
 * 3. Deteksi kembali mana file yang double/duplikat, amankan file double ke folder KLIP_DUPLIKAT.
 * 4. Lanjutkan seperti biasa (ingest DB + auto-assembly FFmpeg).
 */
export async function runTwoStepClipMigration(
  options: MigrationOptions = {}
): Promise<ClipMigrationReport> {
  const ownerId = options.ownerId || DEFAULT_OWNER_ID;
  const userDownloadsDir =
    options.userDownloadsDir ||
    path.join(process.env.USERPROFILE || "", "Downloads");
  const cleanClipsDir =
    options.cleanClipsDir ||
    path.resolve(process.cwd(), "00.FolderOwner", "KLIP_BERSIH");
  const duplicateClipsDir =
    options.duplicateClipsDir ||
    path.resolve(process.cwd(), "00.FolderOwner", "KLIP_DUPLIKAT");
  const finalMasterDir = path.resolve(
    process.cwd(),
    "00.FolderOwner",
    "VIDEO_FINAL_MASTER"
  );

  // Ensure directories exist
  [cleanClipsDir, duplicateClipsDir, finalMasterDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const [items, allScenesGrouped] = await Promise.all([
    listContentItems(ownerId, {
      storePath: options.storePath,
      forceLocal: options.forceLocalStore,
    }),
    listAllScenesGroupedByContent(ownerId, {
      storePath: options.storePath,
      forceLocal: options.forceLocalStore,
    }),
  ]);

  const report: ClipMigrationReport = {
    ok: true,
    timestamp: new Date().toISOString(),
    scannedCount: 0,
    stage1Moved: [],
    stage2Detected: [],
    stage2Unmatched: [],
    stage3Duplicates: [],
    stage4IngestedCount: 0,
    stage4AssembledVideos: [],
    summaryMessage: "",
  };

  if (!fs.existsSync(userDownloadsDir)) {
    report.summaryMessage = `Folder Downloads (${userDownloadsDir}) tidak ditemukan.`;
    return report;
  }

  // Scan Downloads for .mp4 only
  const allEntries = fs.readdirSync(userDownloadsDir, { withFileTypes: true });
  const mp4Files = allEntries
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.toLowerCase().endsWith(".mp4") ||
          e.name.toLowerCase().endsWith(".webm") ||
          e.name.toLowerCase().endsWith(".mov"))
    )
    .map((e) => e.name);

  report.scannedCount = mp4Files.length;

  if (mp4Files.length === 0) {
    report.summaryMessage =
      "Tidak ada file video (.mp4) baru di folder Downloads.";
    return report;
  }

  const touchedContentIds = new Set<string>();

  options.onProgress?.(`[Tahap 1] Memeriksa ${mp4Files.length} file .mp4 di Downloads...`);

  // =========================================================================
  // TAHAP 1: Pindahkan file yang SUDAH SESUAI FORMAT dari Downloads ke KLIP_BERSIH
  // =========================================================================
  const remainingRawFiles: string[] = [];

  for (const filename of mp4Files) {
    const check = isAlreadyStandardNamed(filename, items);
    if (check.isStandard && check.contentCode && check.sceneIndex) {
      const srcPath = path.join(userDownloadsDir, filename);
      const destPath = path.join(cleanClipsDir, filename);

      try {
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath);

        report.stage1Moved.push({
          originalFilename: filename,
          destinationPath: destPath,
          contentCode: check.contentCode,
          sceneIndex: check.sceneIndex,
        });

        const it = items.find((i) => i.contentCode === check.contentCode);
        if (it) touchedContentIds.add(it.id);
      } catch (err) {
        console.error(`Gagal memindahkan file tahap 1: ${filename}`, err);
      }
    } else {
      remainingRawFiles.push(filename);
    }
  }

  options.onProgress?.(`[Tahap 2] Mendeteksi konten untuk ${remainingRawFiles.length} file mentah...`);

  // =========================================================================
  // TAHAP 2: Deteksi & Rename File Mentah dari Downloads ke KLIP_BERSIH
  // (File yang tidak terdeteksi dibiarkan di Downloads)
  // =========================================================================
  for (const filename of remainingRawFiles) {
    const detection = await detectRawClipContentAndScene(
      filename,
      items,
      ownerId,
      {
        storePath: options.storePath,
        forceLocal: options.forceLocalStore,
        allScenesGrouped,
      }
    );

    if (detection.matchedItem && detection.sceneIndex) {
      const canonicalName = buildCanonicalClipFilename(
        detection.matchedItem,
        detection.sceneIndex
      );

      const srcPath = path.join(userDownloadsDir, filename);
      const ext = path.extname(filename);
      const stagingFilename = fs.existsSync(path.join(cleanClipsDir, canonicalName))
        ? `${detection.matchedItem.contentCode}_BAGIAN_${detection.sceneIndex}_raw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`
        : canonicalName;

      const destPath = path.join(cleanClipsDir, stagingFilename);

      try {
        fs.copyFileSync(srcPath, destPath);
        fs.unlinkSync(srcPath);

        report.stage2Detected.push({
          originalFilename: filename,
          renamedFilename: stagingFilename,
          destinationPath: destPath,
          contentCode: detection.matchedItem.contentCode,
          sceneIndex: detection.sceneIndex,
          reason: detection.reason,
        });

        touchedContentIds.add(detection.matchedItem.id);
      } catch (err) {
        console.error(`Gagal memindahkan file tahap 2: ${filename}`, err);
      }
    } else {
      // File tidak terdeteksi -> biarkan di Downloads sesuai instruksi user
      report.stage2Unmatched.push({
        filename,
        reason: detection.reason,
      });
    }
  }

  options.onProgress?.("[Tahap 3] Memeriksa dan mengamankan file double/duplikat...");

  // =========================================================================
  // TAHAP 3: Deteksi File Double / Duplikat di Folder Sementara (KLIP_BERSIH)
  // =========================================================================
  const stagedEntries = fs.readdirSync(cleanClipsDir, { withFileTypes: true });
  const stagedFiles = stagedEntries
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.toLowerCase().endsWith(".mp4") ||
          e.name.toLowerCase().endsWith(".webm") ||
          e.name.toLowerCase().endsWith(".mov"))
    )
    .map((e) => e.name);

  interface StagedCandidate {
    filename: string;
    fullPath: string;
    sizeBytes: number;
    mtimeMs: number;
    contentCode: string;
    sceneIndex: number;
    item: ContentItemRecord;
  }

  const clipsBySceneKey = new Map<string, StagedCandidate[]>();

  for (const file of stagedFiles) {
    const fullPath = path.join(cleanClipsDir, file);
    const stats = fs.statSync(fullPath);

    let matchedItem: ContentItemRecord | null = null;
    let sceneIndex: number | null = null;

    const stdCheck = isAlreadyStandardNamed(file, items);
    if (stdCheck.isStandard && stdCheck.contentCode && stdCheck.sceneIndex) {
      matchedItem =
        items.find((i) => i.contentCode === stdCheck.contentCode) || null;
      sceneIndex = stdCheck.sceneIndex;
    } else {
      const detect = await detectRawClipContentAndScene(file, items, ownerId, {
        storePath: options.storePath,
        forceLocal: options.forceLocalStore,
        allScenesGrouped,
      });
      matchedItem = detect.matchedItem;
      sceneIndex = detect.sceneIndex;
    }

    if (matchedItem && sceneIndex) {
      const key = `${matchedItem.contentCode}_${sceneIndex}`;
      const list = clipsBySceneKey.get(key) || [];
      list.push({
        filename: file,
        fullPath,
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
        contentCode: matchedItem.contentCode,
        sceneIndex,
        item: matchedItem,
      });
      clipsBySceneKey.set(key, list);
    }
  }

  // Resolve duplicates for every scene key
  for (const [, candidates] of clipsBySceneKey.entries()) {
    if (candidates.length <= 1) {
      const single = candidates[0]!;
      const canonicalName = buildCanonicalClipFilename(
        single.item,
        single.sceneIndex
      );
      if (single.filename !== canonicalName) {
        const canonicalPath = path.join(cleanClipsDir, canonicalName);
        if (!fs.existsSync(canonicalPath)) {
          fs.renameSync(single.fullPath, canonicalPath);
        }
      }
      continue;
    }

    // MULTIPLE FILES FOUND FOR SAME SCENE -> DUPLICATE RESOLUTION
    candidates.sort((a, b) => {
      if (Math.abs(a.sizeBytes - b.sizeBytes) < 10240) {
        return b.mtimeMs - a.mtimeMs;
      }
      return b.sizeBytes - a.sizeBytes;
    });

    const best = candidates[0]!;
    const canonicalName = buildCanonicalClipFilename(
      best.item,
      best.sceneIndex
    );
    const canonicalPath = path.join(cleanClipsDir, canonicalName);

    if (best.filename !== canonicalName) {
      if (fs.existsSync(canonicalPath)) {
        const timestampTag = new Date()
          .toISOString()
          .replace(/[:.]/g, "-")
          .slice(0, 19);
        const dupArchivedName = `[DUPLIKAT_${timestampTag}]_${canonicalName}`;
        const dupArchivedPath = path.join(duplicateClipsDir, dupArchivedName);
        fs.renameSync(canonicalPath, dupArchivedPath);
        report.stage3Duplicates.push({
          contentCode: best.contentCode,
          sceneIndex: best.sceneIndex,
          keptFile: canonicalName,
          duplicateFile: canonicalName,
          archivedToPath: dupArchivedPath,
          reason: "File kanonikal lama digantikan oleh file baru dengan ukuran atau timestamp lebih baik",
        });
      }
      fs.renameSync(best.fullPath, canonicalPath);
    }

    // Move all other candidates to KLIP_DUPLIKAT
    const losers = candidates.slice(1);
    for (const loser of losers) {
      const timestampTag = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const dupArchivedName = `[DUPLIKAT_${timestampTag}]_${loser.filename}`;
      const dupArchivedPath = path.join(duplicateClipsDir, dupArchivedName);

      try {
        if (fs.existsSync(loser.fullPath)) {
          fs.renameSync(loser.fullPath, dupArchivedPath);
        }

        report.stage3Duplicates.push({
          contentCode: best.contentCode,
          sceneIndex: best.sceneIndex,
          keptFile: canonicalName,
          duplicateFile: loser.filename,
          archivedToPath: dupArchivedPath,
          reason: `Ukuran file terpilih: ${(best.sizeBytes / 1024 / 1024).toFixed(2)} MB vs Duplikat: ${(loser.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
        });
      } catch (err) {
        console.error(`Gagal mengarsipkan duplikat: ${loser.filename}`, err);
      }
    }
  }

  // =========================================================================
  // TAHAP 4: Ingest ke Database Studio & Jalankan Perakitan Video Master
  // =========================================================================
  if (!options.skipIngest) {
    if (touchedContentIds.size === 0) {
      options.onProgress?.("[Tahap 4] Tidak ada konten baru tersentuh di tahap 1-3. Melewati ingest ulang.");
    } else {
      options.onProgress?.(`[Tahap 4] Sinkronisasi klip baru untuk ${touchedContentIds.size} konten ke database studio...`);
      const finalCleanFiles = fs.readdirSync(cleanClipsDir, { withFileTypes: true })
        .filter(
          (e) =>
            e.isFile() &&
            (e.name.toLowerCase().endsWith(".mp4") ||
              e.name.toLowerCase().endsWith(".webm") ||
              e.name.toLowerCase().endsWith(".mov"))
        )
        .map((e) => e.name);

      for (const filename of finalCleanFiles) {
        const filePath = path.join(cleanClipsDir, filename);
        const check = isAlreadyStandardNamed(filename, items);
        if (!check.isStandard || !check.contentCode || !check.sceneIndex) continue;

        const item = items.find((i) => i.contentCode === check.contentCode);
        if (!item) continue;

        // Ingest hanya untuk konten yang disentuh di tahap 1, 2, atau 3
        if (!touchedContentIds.has(item.id)) {
          continue;
        }

        const scenes = allScenesGrouped[item.id] || [];
        const targetScene = scenes.find((s) => s.sceneIndex === check.sceneIndex);
        if (!targetScene) continue;

        options.onProgress?.(`   • Ingest ${item.contentCode} Bagian ${check.sceneIndex}...`);

        try {
          const clipBuffer = fs.readFileSync(filePath);
          await saveUploadedSceneClip(ownerId, {
            contentId: item.id,
            sceneId: targetScene.id,
            originalFilename: filename,
            mimeType: "video/mp4",
            clipBuffer,
            replaceExistingForScene: true,
          }, {
            storePath: options.storePath,
            forceLocal: options.forceLocalStore,
          });

          report.stage4IngestedCount++;
        } catch (err) {
          console.error(`Gagal ingest database untuk ${filename}:`, err);
        }
      }
    }
  }

  // Check touched contents for auto-assembly
  if (!options.skipAssembly && touchedContentIds.size > 0) {
    options.onProgress?.(`[Tahap 4] Memeriksa kelengkapan scene untuk ${touchedContentIds.size} konten yang diperbarui...`);
    for (const contentId of touchedContentIds) {
      const item = items.find((i) => i.id === contentId);
      if (!item) continue;

      const scenes = allScenesGrouped[contentId] || [];
      const assets = await listAssetsForContent(ownerId, contentId, {
        storePath: options.storePath,
        forceLocal: options.forceLocalStore,
      });

      const completeness = evaluateClipCompleteness(scenes, assets);
      const hasVoice = assets.some(
        (a) => a.contentId === contentId && a.assetType === "voice_audio"
      );

      if (completeness.readyForAssembly && hasVoice) {
        options.onProgress?.(`   🎬 Merakit video master FFmpeg: ${item.contentCode} - ${item.title}...`);
        try {
          const assembly = await runContentVideoAssembly(ownerId, contentId, {
            storePath: options.storePath,
            forceLocal: options.forceLocalStore,
          });

          if (assembly && assembly.finalVideoAsset) {
            const safeTitle = (item.title || "")
              .replace(/[?:/*"<>|\\]/g, "")
              .trim();
            const targetFinalName = `final-${safeTitle}.mp4`;
            const ownerFinalPath = path.join(finalMasterDir, targetFinalName);

            const outPath = assembly.assemblyResult?.outputFilePath;
            if (outPath && fs.existsSync(outPath)) {
              fs.copyFileSync(outPath, ownerFinalPath);
            }

            report.stage4AssembledVideos.push({
              contentCode: item.contentCode,
              title: item.title,
              finalVideoPath: ownerFinalPath,
            });
          }
        } catch (err) {
          console.error(`Gagal perakitan master FFmpeg untuk ${item.contentCode}:`, err);
        }
      }
    }
  }

  report.summaryMessage =
    `Migrasi selesai: ${report.stage1Moved.length} file sesuai dipindahkan, ` +
    `${report.stage2Detected.length} file mentah dideteksi & direname, ` +
    `${report.stage2Unmatched.length} file tak dikenal dibiarkan di Downloads, ` +
    `${report.stage3Duplicates.length} file duplikat diamankan ke KLIP_DUPLIKAT, ` +
    `${report.stage4AssembledVideos.length} video master berhasil dirakit.`;

  return report;
}
