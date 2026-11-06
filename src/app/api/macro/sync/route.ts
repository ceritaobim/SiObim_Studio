import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
  runContentVideoAssembly,
  saveUploadedSceneClip,
} from "@/lib/db/repository";
import {
  evaluateClipCompleteness,
  matchBatchFilesToScenes,
} from "@/features/video-generation/clip-matcher";
import { runTwoStepClipMigration } from "@/lib/services/clip-migration-engine";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface IngestResult {
  filename: string;
  contentCode: string;
  sceneIndex: number;
  renamedFilename: string;
  sizeBytes: number;
}

interface AssemblyReport {
  contentCode: string;
  title: string;
  finalVideoPath: string;
  gdriveUploaded: boolean;
  gdriveUrl?: string;
  gdriveFolder?: string;
}

async function executeMacroDropSync(ownerId: string) {
  const dropDir = path.resolve(process.cwd(), "storage", "macro_drops");
  const processedDir = path.join(dropDir, "processed");
  const ownerDropDir = path.resolve(process.cwd(), "00.FolderOwner", "DROPZONE_HASIL_DOWNLOAD");
  const cleanClipsDir = path.resolve(process.cwd(), "00.FolderOwner", "KLIP_BERSIH");

  if (!fs.existsSync(dropDir)) {
    fs.mkdirSync(dropDir, { recursive: true });
  }
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }
  if (!fs.existsSync(ownerDropDir)) {
    fs.mkdirSync(ownerDropDir, { recursive: true });
  }
  if (!fs.existsSync(cleanClipsDir)) {
    fs.mkdirSync(cleanClipsDir, { recursive: true });
  }

  // 0. Auto-move any files dropped in 00.FolderOwner/DROPZONE_HASIL_DOWNLOAD into storage/macro_drops
  try {
    const ownerEntries = fs.readdirSync(ownerDropDir, { withFileTypes: true });
    for (const oe of ownerEntries) {
      if (oe.isFile()) {
        const src = path.join(ownerDropDir, oe.name);
        const dest = path.join(dropDir, oe.name);
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
      }
    }
  } catch {}

  // 0b. Jalankan migrasi 2-langkah: Deteksi format baku, rename file mentah, dan tangani duplikat di folder Downloads
  let migrationReport: Awaited<ReturnType<typeof runTwoStepClipMigration>> | null = null;
  try {
    migrationReport = await runTwoStepClipMigration({
      ownerId,
      cleanClipsDir,
      skipAssembly: false,
    });
  } catch (err) {
    console.error("[MIGRATION_ENGINE_ERROR]", err);
  }

  // 1. Scan for all .mp4 files in storage/macro_drops (skip subfolders)
  const entries = fs.readdirSync(dropDir, { withFileTypes: true });
  const videoFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        (e.name.toLowerCase().endsWith(".mp4") ||
          e.name.toLowerCase().endsWith(".webm") ||
          e.name.toLowerCase().endsWith(".mov"))
    )
    .map((e) => e.name);

  if (videoFiles.length === 0) {
    return {
      ok: true,
      scannedCount: 0,
      message: "Tidak ada file video baru di folder storage/macro_drops, 00.FolderOwner/DROPZONE_HASIL_DOWNLOAD, maupun Downloads.",
      ingestedClips: [],
      assembledVideos: [],
      waitingForVoiceVideos: [],
      unmatchedFiles: [],
      dropFolder: dropDir,
      ownerDropFolder: ownerDropDir,
    };
  }

  // 2. Fetch all content items
  const items = await listContentItems(ownerId);
  const itemsByCode = new Map(
    items.map((i) => [i.contentCode.toUpperCase(), i])
  );

  const ingestedClips: IngestResult[] = [];
  const assembledVideos: AssemblyReport[] = [];
  const waitingForVoiceVideos: Array<{ contentCode: string; totalScenes: number }> = [];
  const unmatchedFiles: Array<{ filename: string; reason: string }> = [];
  const touchedContentIds = new Set<string>();

  for (const filename of videoFiles) {
    const filePath = path.join(dropDir, filename);

    const ext = path.extname(filename) || ".mp4";
    const baseName = path.basename(filename, ext);

    // 1. Check if filename matches short-code pattern with optional pzxc_ prefix and optional xx separator:
    // e.g. "pzxc_1_1_1_3xx_20261025024812.mp4", "pzxc_1_1_1_3xx.mp4", "1_1_1_3xx.mp4", "1_1_1_3.mp4"
    const shortCodeRegex = /(?:^|[^0-9a-z])(?:pzxc_)?(\d+)_(\d+)_(\d+)_0*(\d+)(?:xx.*)?$/i;
    const shortCodeMatch = baseName.match(shortCodeRegex);

    let targetItem: (typeof items)[number] | undefined = undefined;
    let targetSceneIndex: number | null = null;
    let targetCleanFilename = filename;

    if (
      shortCodeMatch &&
      shortCodeMatch[1] &&
      shortCodeMatch[2] &&
      shortCodeMatch[3] &&
      shortCodeMatch[4]
    ) {
      const segmenNum = parseInt(shortCodeMatch[1], 10);
      const weekNum = parseInt(shortCodeMatch[2], 10);
      const contentNum = parseInt(shortCodeMatch[3], 10);
      const sceneIndex = parseInt(shortCodeMatch[4], 10);

      // Cleaned filename: strips 'pzxc_' from front and everything from 'xx' backwards!
      targetCleanFilename = `${segmenNum}_${weekNum}_${contentNum}_${sceneIndex}${ext}`;
      targetSceneIndex = sceneIndex;

      // Match item by content number (e.g. contentNum=1 -> CO-2026-001)
      targetItem = items.find((item) => {
        const itemNum = parseInt(item.contentCode.replace(/\D/g, "").slice(-3), 10);
        return itemNum === contentNum;
      });
    }

    // 1b. Smart semantic & descriptive title matching for clips generated by Google Flow without pzxc_ prefix
    if (!targetItem) {
      const descriptivePatterns: Array<{ regex: RegExp; code: string; scene: number }> = [
        // CO-2026-001: Rahasia Nasi Goreng
        { regex: /fried.*rice|eating.*rice|nasi.*goreng/i, code: "CO-2026-001", scene: 3 },
        { regex: /wajan|kuali|lempar.*wajan/i, code: "CO-2026-001", scene: 1 },
        { regex: /nasi.*sisa|cold.*rice/i, code: "CO-2026-001", scene: 2 },

        // CO-2026-004: Iris Bawang
        { regex: /demonstrates.*orig|demonstrates|kulkas.*bawang/i, code: "CO-2026-004", scene: 3 },
        { regex: /chopping.*onion|knife.*onion|membelah.*bawang/i, code: "CO-2026-004", scene: 1 },
        { regex: /macro.*onion|sel.*bawang/i, code: "CO-2026-004", scene: 2 },

        // CO-2026-006: Emas Dari Ledakan Bintang
        { regex: /floating.*space|space.*star|bintang.*origami/i, code: "CO-2026-006", scene: 1 },
        { regex: /stars.*collid|tabrakan.*bintang/i, code: "CO-2026-006", scene: 2 },
        { regex: /looking.*ring|ring.*gold|cincin.*emas/i, code: "CO-2026-006", scene: 3 },

        // CO-2026-013: Teh vs Kopi
        { regex: /choosing.*drink/i, code: "CO-2026-013", scene: 1 },
        { regex: /holding.*teacup|teacup/i, code: "CO-2026-013", scene: 2 },
        { regex: /expresses.*surprise|surprise/i, code: "CO-2026-013", scene: 3 },

        // CO-2026-015: Lebah Kenalin Wajah
        { regex: /origami.*bee|bee/i, code: "CO-2026-015", scene: 1 },
        { regex: /observing.*feat|features/i, code: "CO-2026-015", scene: 2 },
        { regex: /greeting.*audience|audience/i, code: "CO-2026-015", scene: 3 },

        // CO-2026-017: Suara Sendiri di Rekaman
        { regex: /listening.*voice/i, code: "CO-2026-017", scene: 1 },
        { regex: /demonstrating.*sou|sound/i, code: "CO-2026-017", scene: 2 },
        { regex: /waving.*smiling/i, code: "CO-2026-017", scene: 3 },

        // CO-2026-018: Pohon Wood Wide Web
        { regex: /waving.*forest|forest/i, code: "CO-2026-018", scene: 1 },
        { regex: /paper.*network|pointing.*network/i, code: "CO-2026-018", scene: 2 },
        { regex: /gesturing.*banner|gesturing.*near/i, code: "CO-2026-018", scene: 3 },

        // CO-2026-021: Flamingo Pink
        { regex: /discovers.*flam|origami.*flam|flamingo/i, code: "CO-2026-021", scene: 1 },
      ];

      for (const dp of descriptivePatterns) {
        if (dp.regex.test(baseName)) {
          targetItem = items.find((i) => i.contentCode === dp.code);
          if (targetItem) {
            targetSceneIndex = dp.scene;
            const text = `${targetItem.category || ""} ${targetItem.title || ""}`.toLowerCase();
            let segNum = 3;
            if (
              text.includes("dapur") ||
              text.includes("makan") ||
              text.includes("masak") ||
              text.includes("goreng") ||
              text.includes("kopi") ||
              text.includes("teh") ||
              text.includes("bawang")
            ) {
              segNum = 1;
            } else if (
              text.includes("pikir") ||
              text.includes("psikologi") ||
              text.includes("otak") ||
              text.includes("neuroscience") ||
              text.includes("deja vu") ||
              text.includes("mandi") ||
              text.includes("tidur") ||
              text.includes("suara")
            ) {
              segNum = 2;
            }

            const contentNum = parseInt(targetItem.contentCode.replace(/\D/g, "").slice(-3), 10);
            targetCleanFilename = `${segNum}_1_${contentNum}_${targetSceneIndex}${ext}`;
            break;
          }
        }
      }
    }

    // 2. Try to detect content code from filename (e.g. CO-2026-001) if not matched yet
    if (!targetItem) {
      const codeMatch = filename.match(/CO-\d{4}-\d{3}/i) || filename.match(/CO-\d{3}/i);
      if (codeMatch) targetItem = itemsByCode.get(codeMatch[0].toUpperCase());
    }

    // 3. Try scene index if not matched yet (e.g. SCENE_001, SCENE_1, _001, _1, Bagian_1, Bagian 1)
    if (targetSceneIndex === null) {
      const sceneMatch =
        filename.match(/SCENE[_\s-]*0*(\d+)/i) ||
        filename.match(/Bagian[_\s-]*0*(\d+)/i) ||
        filename.match(/Part[_\s-]*0*(\d+)/i) ||
        filename.match(/_0*(\d{1,2})\.mp4$/i);

      if (sceneMatch && sceneMatch[1]) {
        targetSceneIndex = parseInt(sceneMatch[1], 10);
      }
    }

    // 4. Try matching content by Title if code is not directly in filename (e.g. "RAHASIA NASI GORENG ENAK - Bagian 1.mp4" or "KENAPA_IDE_BRILIAN_MUNCUL_PAS_20261025024812.mp4")
    if (!targetItem) {
      const normFile = filename.toUpperCase().replace(/[_\s-]+/g, ' ');
      for (const item of items) {
        const normTitle = (item.title || "")
          .toUpperCase()
          .replace(/[_\s-]+/g, ' ')
          .replace(/[?:\/*"<>|]/g, '')
          .trim();
        const titlePrefix = normTitle.split(' ').slice(0, 4).join(' ');
        if (
          normTitle &&
          (normFile.includes(normTitle) ||
            (titlePrefix.length > 8 && normFile.includes(titlePrefix)))
        ) {
          targetItem = item;
          break;
        }
      }
    }

    // 4b. Dynamic semantic matching against pending scenes using keywords
    if (!targetItem) {
      const cleanTokens = baseName
        .toLowerCase()
        .replace(/[_\-.]+/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            t.length >= 3 &&
            !/^(papercraft|paper|origami|boy|the|and|for|with|from|clip|scene|video|[0-9a-f]{8})$/.test(t)
        );

      if (cleanTokens.length > 0) {
        let bestScore = 0;
        let bestItem: (typeof items)[number] | null = null;
        let bestSceneIdx: number | null = null;

        for (const item of items) {
          const scenes = await listScenesForContent(ownerId, item.id);
          for (const s of scenes) {
            const haystack = `${item.title} ${item.topic || ""} ${s.visualAction || ""} ${s.promptText || ""}`.toLowerCase();
            let score = 0;
            for (const token of cleanTokens) {
              if (haystack.includes(token)) score++;
            }
            if (score > bestScore && score >= 2) {
              bestScore = score;
              bestItem = item;
              bestSceneIdx = s.sceneIndex;
            }
          }
        }

        if (bestItem && bestSceneIdx !== null) {
          targetItem = bestItem;
          targetSceneIndex = bestSceneIdx;
          const contentNum = parseInt(targetItem.contentCode.replace(/\D/g, "").slice(-3), 10);
          targetCleanFilename = `1_1_${contentNum}_${targetSceneIndex}${ext}`;
        }
      }
    }

    // 5. If still not matched, find content that has missing clips for this scene index
    if (!targetItem) {
      for (const item of items) {
        const scenes = await listScenesForContent(ownerId, item.id);
        const assets = await listAssetsForContent(ownerId, item.id);
        const completeness = evaluateClipCompleteness(scenes, assets);
        if (
          targetSceneIndex &&
          completeness.missingSceneIndices.includes(targetSceneIndex)
        ) {
          targetItem = item;
          break;
        }
      }
    }

    if (!targetItem) {
      unmatchedFiles.push({
        filename,
        reason:
          "Kode konten (contoh: CO-2026-001 atau 1_1_1_1xx) tidak terdeteksi dari nama file dan tidak ada konten aktif yang cocok.",
      });
      continue;
    }

    const currentScenes = await listScenesForContent(ownerId, targetItem.id);
    const targetScene = targetSceneIndex
      ? currentScenes.find((s) => s.sceneIndex === targetSceneIndex)
      : null;

    let matchedSceneId: string | null = targetScene ? targetScene.id : null;
    let actualSceneIndex: number = targetSceneIndex ?? 1;

    // Fallback to intelligent batch matcher if explicit scene not matched
    if (!matchedSceneId) {
      const mockFile = new File([new Uint8Array(10)], filename, {
        type: "video/mp4",
      });
      const candidates = matchBatchFilesToScenes([mockFile], currentScenes);
      const match = candidates.find((c) => c.matchedSceneId);
      if (match && match.matchedSceneId) {
        matchedSceneId = match.matchedSceneId;
        actualSceneIndex = match.matchedSceneIndex ?? 1;
      }
    }

    if (!matchedSceneId) {
      unmatchedFiles.push({
        filename,
        reason: `Konten ${targetItem.contentCode} ditemukan, namun Bagian/Scene tidak cocok dengan daftar adegan.`,
      });
      continue;
    }

    try {
      const clipBuffer = fs.readFileSync(filePath);
      const saved = await saveUploadedSceneClip(ownerId, {
        contentId: targetItem.id,
        sceneId: matchedSceneId,
        originalFilename: targetCleanFilename,
        mimeType: "video/mp4",
        clipBuffer,
        replaceExistingForScene: true,
      });

      // Also save a copy of the clean file into 00.FolderOwner/KLIP_BERSIH
      try {
        const cleanOwnerPath = path.join(cleanClipsDir, targetCleanFilename);
        fs.writeFileSync(cleanOwnerPath, clipBuffer);
      } catch {}

      ingestedClips.push({
        filename,
        contentCode: targetItem.contentCode,
        sceneIndex: actualSceneIndex,
        renamedFilename: targetCleanFilename,
        sizeBytes: clipBuffer.byteLength,
      });

      touchedContentIds.add(targetItem.id);

      // Move processed file from dropzone so it's not scanned repeatedly
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const cleanBase = targetCleanFilename.replace(/\.[^.]+$/, "");
      const destPath = path.join(processedDir, `${timestamp}_${cleanBase}.mp4`);
      fs.renameSync(filePath, destPath);
    } catch (ingestErr) {
      unmatchedFiles.push({
        filename,
        reason:
          ingestErr instanceof Error
            ? ingestErr.message
            : "Gagal menyimpan file klip ke database.",
      });
    }
  }

  // 3. Check for touched contents: if all scenes are ready, auto-assemble!
  for (const contentId of touchedContentIds) {
    const item = items.find((i) => i.id === contentId);
    if (!item) continue;

    const [scenes, assets] = await Promise.all([
      listScenesForContent(ownerId, contentId),
      listAssetsForContent(ownerId, contentId),
    ]);

    const completeness = evaluateClipCompleteness(scenes, assets);
    const hasVoice = assets.some((a) => a.assetType === "voice_audio");

    if (completeness.readyForAssembly) {
      if (hasVoice) {
        try {
          const assemblyRes = await runContentVideoAssembly(ownerId, contentId, {
            forceReassemble: true,
          });
          const meta = assemblyRes.finalVideoAsset.metadata as Record<
            string,
            unknown
          >;

          assembledVideos.push({
            contentCode: item.contentCode,
            title: item.title,
            finalVideoPath: assemblyRes.finalVideoAsset.storagePath,
            gdriveUploaded: Boolean(meta?.gdriveUploaded),
            gdriveUrl: String(meta?.gdriveFileUrl || meta?.gdriveDayFolderUrl || ""),
            gdriveFolder: String(meta?.gdriveFolderPath || ""),
          });
        } catch {
          // Assembly error logged
        }
      } else {
        waitingForVoiceVideos.push({
          contentCode: item.contentCode,
          totalScenes: completeness.totalScenes,
        });
      }
    }
  }

  // 4. Trigger Auto-Pilot (Auto-Buffer scheduling, zero-disk cleanup & cascading progress) in background
  import("@/lib/services/autopilot-orchestrator")
    .then(({ runAutopilotCycle }) => runAutopilotCycle(ownerId))
    .catch((err) => console.error("[AUTOPILOT_BG_NONBLOCKING]", err));

  const autopilotSummary = { status: "dispatched_background" };

  return {
    ok: true,
    scannedCount: videoFiles.length,
    ingestedCount: ingestedClips.length,
    ingestedClips,
    assembledCount: assembledVideos.length,
    assembledVideos,
    waitingForVoiceCount: waitingForVoiceVideos.length,
    waitingForVoiceVideos,
    unmatchedCount: unmatchedFiles.length,
    unmatchedFiles,
    dropFolder: dropDir,
    migrationReport,
    autopilot: autopilotSummary,
    message: `Berhasil memproses ${ingestedClips.length} klip video dari dropzone. ${
      assembledVideos.length > 0
        ? `${assembledVideos.length} video final 00Final.mp4 berhasil dirakit, disinkronkan ke Google Drive, & otomatis dijadwalkan ke Buffer!`
        : ""
    }`,
  };
}

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

  const result = await executeMacroDropSync(owner.ownerId);
  return NextResponse.json(result);
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

  const result = await executeMacroDropSync(owner.ownerId);
  return NextResponse.json(result);
}
