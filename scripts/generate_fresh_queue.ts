import fs from "fs";
import path from "path";
import { DEFAULT_OWNER_ID } from "../src/lib/config/env";
import {
  listContentItems,
  listScenesForContent,
  listAssetsForContent,
  saveScenesForContent,
  getProjectSettings,
} from "../src/lib/db/repository";
import { segmentNarrationIntoScenes } from "../src/features/scenes/scene-segmenter";
import { buildPromptsForScenes } from "../src/features/scenes/prompt-generator";
import { evaluateClipCompleteness } from "../src/features/video-generation/clip-matcher";
import type { SceneRecord } from "../src/types/domain";

async function main() {
  console.log("================================================================");
  console.log("🔄 CERITAOBIM STUDIO — REFRESH QUEUE & STRICT 10S/8S SEGMENTASI");
  console.log("================================================================\n");

  const ownerId = DEFAULT_OWNER_ID;
  const settings = await getProjectSettings(ownerId);
  const items = await listContentItems(ownerId);

  const characterRosterSummary =
    "MAIN CHARACTER(S): Obim — Figur anak muda ramah dari lipatan kertas origami bertekstur doff (matte craft paper). Rambut potongan mangkuk/jamur (bowl-cut) dari lipatan kertas biru-hitam gelap berlipit vertikal rapi. Wajah kertas warna krem hangat dengan mata melengkung tersenyum ramah (happy closed-eye smile). Memakai kemeja flanel lengan panjang motif kotak-kotak merah-hitam-putih (red-black-white plaid flannel paper shirt) dengan lengan digulung sesiku, celana panjang kertas biru dongker (dark navy-blue folded paper pants), dan sepatu kertas cokelat tua. (Ramah, selalu tersenyum hangat, penasaran, ekspresif namun tenang saat menjelaskan fakta psikologi & kehidupan sehari-hari.)";

  const parseWeekNum = (notes: string, code: string): number => {
    const match = notes.match(/Week\s*(\d+)/i);
    if (match && match[1]) return parseInt(match[1], 10);
    const codeMatch = code.match(/(\d+)$/);
    if (codeMatch && codeMatch[1]) {
      const seq = parseInt(codeMatch[1], 10);
      return Math.max(1, Math.ceil(seq / 21));
    }
    return 1;
  };

  const parseDayNum = (notes: string, code: string): number => {
    const match = notes.match(/Hari\s*(\d+)/i);
    if (match && match[1]) return parseInt(match[1], 10);
    const codeMatch = code.match(/(\d+)$/);
    if (codeMatch && codeMatch[1]) {
      const seq = parseInt(codeMatch[1], 10);
      const pos = (seq - 1) % 21;
      return Math.floor(pos / 3) + 1;
    }
    return 1;
  };

  // Sort: highest week first (newest), then day 1 to 7 ascending within week
  const sortedItems = [...items].sort((a, b) => {
    const weekA = parseWeekNum(a.notes || "", a.contentCode);
    const weekB = parseWeekNum(b.notes || "", b.contentCode);
    if (weekB !== weekA) return weekB - weekA;
    const dayA = parseDayNum(a.notes || "", a.contentCode);
    const dayB = parseDayNum(b.notes || "", b.contentCode);
    return dayA - dayB;
  });

  interface MacroTask {
    taskIndex: number;
    contentId: string;
    contentCode: string;
    title: string;
    category: string;
    weekNum: number;
    dayNum: number;
    sceneIndex: number;
    sceneId: string;
    expectedFilename: string;
    cleanFilename: string;
    startMs: number;
    endMs: number;
    durationSeconds: number;
    narrationText: string;
    promptText: string;
    visualAction: string;
    cameraDirection: string;
    suggestedDropPath: string;
    status: "completed" | "pending";
  }

  const queueItems: Record<string, unknown>[] = [];
  const pendingTasks: MacroTask[] = [];
  let totalPendingScenes = 0;
  let totalUploadedScenes = 0;

  for (const item of sortedItems) {
    const weekNum = parseWeekNum(item.notes || "", item.contentCode);
    const dayNum = parseDayNum(item.notes || "", item.contentCode);

    const [existingScenes, assets] = await Promise.all([
      listScenesForContent(ownerId, item.id),
      listAssetsForContent(ownerId, item.id),
    ]);

    const latestVoiceAsset = assets.find((a) => a.assetType === "voice_audio");
    const audioDurMs =
      latestVoiceAsset?.durationMs || item.targetDurationSeconds * 1000;

    // Check if existing scenes have fragmented durations (< 8s non-last) or > 10s
    const isFragmented = existingScenes.some(
      (sc, idx) =>
        idx < existingScenes.length - 1 &&
        Math.round((sc.endMs - sc.startMs) / 1000) < 8
    );
    const isOverTen = existingScenes.some(
      (sc) => Math.round((sc.endMs - sc.startMs) / 1000) > 10
    );

    let scenes: SceneRecord[] = existingScenes;

    if (existingScenes.length === 0 || isFragmented || isOverTen) {
      console.log(
        `✂️  Re-segmenting [${item.contentCode}] "${item.title}" strictly into 10s/8s parts...`
      );
      const rawScenes = segmentNarrationIntoScenes({
        contentId: item.id,
        contentCode: item.contentCode,
        narrationText: item.narration,
        timestampStatus: latestVoiceAsset ? "actual" : "estimated",
        totalAudioDurationMs: audioDurMs,
        minSceneSeconds: 8,
        maxSceneSeconds: 10,
      });

      // Preserve any existing clip uploads
      const prevByIndex = new Map(existingScenes.map((s) => [s.sceneIndex, s]));
      const preserved = rawScenes.map((sc) => {
        const prev = prevByIndex.get(sc.sceneIndex);
        if (prev?.uploadedClipAssetId) {
          return {
            ...sc,
            id: prev.id,
            uploadedClipAssetId: prev.uploadedClipAssetId,
            sceneStatus: prev.sceneStatus,
          };
        }
        return sc;
      });

      // Build updated prompts with Omni 1.1 Flash & duration masking
      const withPrompts = buildPromptsForScenes({
        settings,
        content: item,
        scenes: preserved,
        characterRosterSummary,
      });

      await saveScenesForContent(ownerId, item.id, withPrompts);
      scenes = withPrompts;
    }

    const hasVoice = assets.some(
      (a) => a.contentId === item.id && a.assetType === "voice_audio"
    );
    const hasFinalVideo = assets.some(
      (a) => a.contentId === item.id && a.assetType === "final_video"
    );
    const completeness = evaluateClipCompleteness(scenes, assets);

    const safeTitle = (item.title || "")
      .replace(/[?:\\/*"<>|]/g, "")
      .trim()
      .toUpperCase();

    const mappedScenes = scenes.map((sc) => {
      const isDone =
        Boolean(sc.uploadedClipAssetId) ||
        sc.sceneStatus === "clip_uploaded" ||
        sc.sceneStatus === "validated";
      if (isDone) {
        totalUploadedScenes++;
      } else {
        totalPendingScenes++;
      }

      const rawDur = Math.round((sc.endMs - sc.startMs) / 1000) || 10;
      const durationSeconds = rawDur >= 9 ? 10 : 8;

      const taskStatus: "completed" | "pending" = isDone ? "completed" : "pending";
      const task: MacroTask = {
        taskIndex: pendingTasks.length + 1,
        contentId: item.id,
        contentCode: item.contentCode,
        title: item.title,
        category: item.category,
        weekNum,
        dayNum,
        sceneIndex: sc.sceneIndex,
        sceneId: sc.id,
        expectedFilename: sc.expectedFilename,
        cleanFilename: `${safeTitle} - Bagian ${sc.sceneIndex}.mp4`,
        startMs: sc.startMs,
        endMs: sc.endMs,
        durationSeconds,
        narrationText: sc.narrationText,
        promptText: sc.promptText,
        visualAction: sc.visualAction,
        cameraDirection: sc.cameraDirection,
        suggestedDropPath: `storage/macro_drops/${sc.expectedFilename}`,
        status: taskStatus,
      };

      if (!isDone) {
        pendingTasks.push(task);
      }

      return task;
    });

    queueItems.push({
      contentId: item.id,
      contentCode: item.contentCode,
      title: item.title,
      category: item.category,
      weekNum,
      dayNum,
      hasVoice,
      hasFinalVideo,
      readyForAssembly: completeness.readyForAssembly,
      uploadedCount: completeness.uploadedSceneCount,
      totalCount: completeness.totalScenes,
      scenes: mappedScenes,
    });
  }

  const firstSorted = sortedItems[0];
  const latestWeek = firstSorted
    ? parseWeekNum(firstSorted.notes || "", firstSorted.contentCode)
    : 1;

  const result = {
    ok: true,
    latestWeek,
    totalItems: sortedItems.length,
    totalPendingScenes,
    totalUploadedScenes,
    macroDropFolder: path.resolve(process.cwd(), "storage", "macro_drops"),
    pendingTasks,
    items: queueItems,
    updatedAt: new Date().toISOString(),
  };

  const macroDir = path.join(process.cwd(), "storage", "macro");
  if (!fs.existsSync(macroDir)) {
    fs.mkdirSync(macroDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(macroDir, "queue.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(macroDir, "pending_tasks.json"),
    JSON.stringify(pendingTasks, null, 2),
    "utf8"
  );

  const csvHeader =
    "task_index,content_code,scene_index,expected_filename,duration_sec,program,title,prompt_text\n";
  const csvRows = pendingTasks
    .map((t) =>
      [
        t.taskIndex,
        t.contentCode,
        t.sceneIndex,
        t.expectedFilename,
        t.durationSeconds,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.promptText || "").replace(/"/g, '""')}"`,
      ].join(",")
    )
    .join("\n");
  fs.writeFileSync(path.join(macroDir, "pending_tasks.csv"), csvHeader + csvRows, "utf8");

  console.log(`\n✅ queue.json & pending_tasks.json successfully updated!`);
  console.log(`📊 Total Items          : ${sortedItems.length}`);
  console.log(`🎬 Total Pending Scenes : ${totalPendingScenes} scenes (all 10s or 8s)`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
