import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  generateAndSaveScenePrompts,
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
  listScenesForContent,
} from "@/lib/db/repository";
import { evaluateClipCompleteness } from "@/features/video-generation/clip-matcher";

export const dynamic = "force-dynamic";

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
  const requestedWeek = url.searchParams.get("week");
  const requestedProgram = url.searchParams.get("program");
  const forceRegenerate = url.searchParams.get("regenerate") === "true";

  // 1. Fetch all items, scenes, and assets in a single batch query
  const [allItems, allScenesGrouped, allAssets] = await Promise.all([
    listContentItems(owner.ownerId),
    listAllScenesGroupedByContent(owner.ownerId),
    listAssetsForContent(owner.ownerId),
  ]);

  const assetsByContentId = new Map<string, typeof allAssets>();
  for (const a of allAssets) {
    if (!a.contentId) continue;
    const list = assetsByContentId.get(a.contentId) || [];
    list.push(a);
    assetsByContentId.set(a.contentId, list);
  }

  // Group items by week and sort newest week first
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

  // Sort: earlier week first (Week 1 before Week 2 so incomplete weeks finish first), then sequence ascending
  const sortedItems = [...allItems].sort((a, b) => {
    const weekA = parseWeekNum(a.notes || "", a.contentCode);
    const weekB = parseWeekNum(b.notes || "", b.contentCode);
    if (weekA !== weekB) return weekA - weekB; // Complete Week 1 first!
    const numA = parseInt((a.contentCode || "").replace(/\D/g, ""), 10) || 0;
    const numB = parseInt((b.contentCode || "").replace(/\D/g, ""), 10) || 0;
    if (numA !== numB) return numA - numB;
    const dayA = parseDayNum(a.notes || "", a.contentCode);
    const dayB = parseDayNum(b.notes || "", b.contentCode);
    return dayA - dayB;
  });

  // Filter if requested
  const filteredItems = sortedItems.filter((item) => {
    if (requestedWeek) {
      const w = parseWeekNum(item.notes || "", item.contentCode);
      if (String(w) !== requestedWeek) return false;
    }
    if (requestedProgram) {
      const prog = (item.category || "").toLowerCase();
      if (!prog.includes(requestedProgram.toLowerCase())) return false;
    }
    return true;
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

  for (const item of filteredItems) {
    const weekNum = parseWeekNum(item.notes || "", item.contentCode);
    const dayNum = parseDayNum(item.notes || "", item.contentCode);

    let scenes = allScenesGrouped[item.id] || [];
    const assets = assetsByContentId.get(item.id) || [];

    const needsPrompts =
      scenes.length === 0 ||
      forceRegenerate ||
      scenes.some((sc) => !sc.promptText || sc.promptText.trim().length === 0);

    if (needsPrompts) {
      try {
        scenes = await generateAndSaveScenePrompts(owner.ownerId, item.id);
      } catch {
        // Fallback to empty if prompt generation fails
      }
    }

    const hasVoice = assets.some(
      (a) => a.contentId === item.id && a.assetType === "voice_audio"
    );
    const hasFinalVideo = assets.some(
      (a) => a.contentId === item.id && a.assetType === "final_video"
    );
    const completeness = evaluateClipCompleteness(scenes, assets);

    const mappedScenes = scenes.map((sc) => {
      // 1. Check if the scene clip already exists in assets
      const hasSceneClip = assets.some(
        (a) =>
          a.contentId === item.id &&
          a.assetType === "scene_video" &&
          (a.sceneId === sc.id ||
            a.id === sc.uploadedClipAssetId ||
            a.originalFilename === `Bagian ${sc.sceneIndex}.mp4` ||
            (a.metadata as Record<string, unknown> | undefined)?.partIndex ===
              sc.sceneIndex ||
            a.originalFilename.includes(`_Bagian_0${sc.sceneIndex}`) ||
            a.originalFilename.includes(`SCENE_00${sc.sceneIndex}`))
      );

      // 2. Scene is done if final video is already assembled OR clip asset exists OR status is uploaded/validated
      const isDone =
        hasFinalVideo ||
        hasSceneClip ||
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
        cleanFilename: `${(item.title || "").replace(/[?:\\/*"<>|]/g, "").trim().toUpperCase()} - Bagian ${sc.sceneIndex}.mp4`,
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
    totalItems: filteredItems.length,
    totalPendingScenes,
    totalUploadedScenes,
    macroDropFolder: path.resolve(process.cwd(), "storage", "macro_drops"),
    pendingTasks,
    items: queueItems,
    updatedAt: new Date().toISOString(),
  };

  // Auto-sync JSON files to disk for seamless macro consumption
  try {
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

    // Also write simple CSV for batch tools
    const csvHeader = "task_index,content_code,scene_index,expected_filename,duration_sec,program,title,prompt_text\n";
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
  } catch {
    // Non-fatal if disk write fails
  }

  return NextResponse.json(result);
}
