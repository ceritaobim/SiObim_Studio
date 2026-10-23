import type { AssetRecord, SceneRecord } from "@/types/domain";

export interface ClipSceneMatch {
  filename: string;
  matchedSceneIndex: number | null;
  matchedSceneId: string | null;
  expectedFilename: string | null;
  reason: string;
}

export interface ClipCompletenessReport {
  readyForAssembly: boolean;
  totalScenes: number;
  uploadedSceneCount: number;
  missingSceneIndices: number[];
  missingExpectedFilenames: string[];
  duplicateSceneIndices: number[];
  unmappedFilenames: string[];
}

/**
 * Infers which scene index a clip filename belongs to.
 * Supports:
 * 1. Exact expectedFilename match (`CO-2026-001_SCENE_001.mp4`)
 * 2. Explicit Indonesian `Bagian 1`, `Bagian_2`, `Bagian-3`, `bagian04`
 * 3. English `Part 1`, `Part_2`, `Part-3`, `part04`
 * 4. Pattern `SCENE_001`, `scene-1`, `sc02`, `klip_1`, `clip_1`
 * 5. Parentheses or trailing number in filename (`(1).mp4`, `001.mp4`, `klip_3.mp4`)
 */
export function matchFilenameToScene(
  filename: string,
  scenes: Pick<SceneRecord, "id" | "sceneIndex" | "expectedFilename">[]
): ClipSceneMatch {
  const cleanName = filename.trim();
  const upperName = cleanName.toUpperCase();

  // 1. Exact match on expectedFilename
  const exact = scenes.find(
    (s) => s.expectedFilename.toUpperCase() === upperName
  );
  if (exact) {
    return {
      filename: cleanName,
      matchedSceneIndex: exact.sceneIndex,
      matchedSceneId: exact.id,
      expectedFilename: exact.expectedFilename,
      reason: `Cocok persis dengan nama file target (${exact.expectedFilename})`,
    };
  }

  // 2. Match explicit "BAGIAN" pattern (e.g. "Bagian 1", "Bagian_2", "Bagian-3", "Bagian04")
  const bagianPattern = upperName.match(/(?:BAGIAN|BAG)[-_ ]?0*(\d+)/i);
  if (bagianPattern?.[1]) {
    const idx = parseInt(bagianPattern[1], 10);
    const target = scenes.find((s) => s.sceneIndex === idx);
    if (target) {
      return {
        filename: cleanName,
        matchedSceneIndex: target.sceneIndex,
        matchedSceneId: target.id,
        expectedFilename: target.expectedFilename,
        reason: `Terdeteksi Bagian #${target.sceneIndex} dari nama file`,
      };
    }
  }

  // 3. Match explicit "PART" pattern (e.g. "Part 1", "Part_02")
  const partPattern = upperName.match(/PART[-_ ]?0*(\d+)/i);
  if (partPattern?.[1]) {
    const idx = parseInt(partPattern[1], 10);
    const target = scenes.find((s) => s.sceneIndex === idx);
    if (target) {
      return {
        filename: cleanName,
        matchedSceneIndex: target.sceneIndex,
        matchedSceneId: target.id,
        expectedFilename: target.expectedFilename,
        reason: `Terdeteksi Part #${target.sceneIndex} dari nama file`,
      };
    }
  }

  // 4. Match explicit `SCENE_001` / `SCENE-1` / `SC_2` / `KLIP_1` / `CLIP_1` pattern
  const scenePattern = upperName.match(/(?:SCENE|SC|KLIP|CLIP)[-_ ]?0*(\d+)/i);
  if (scenePattern?.[1]) {
    const idx = parseInt(scenePattern[1], 10);
    const target = scenes.find((s) => s.sceneIndex === idx);
    if (target) {
      return {
        filename: cleanName,
        matchedSceneIndex: target.sceneIndex,
        matchedSceneId: target.id,
        expectedFilename: target.expectedFilename,
        reason: `Terdeteksi Scene/Klip #${target.sceneIndex} dari nama file`,
      };
    }
  }

  // 5. Match parentheses e.g. "Video (1).mp4", "download (2).mp4"
  const baseWithoutExt = cleanName.replace(/\.[^.]+$/, "");
  const parenPattern = baseWithoutExt.match(/\(0*(\d+)\)$/);
  if (parenPattern?.[1]) {
    const idx = parseInt(parenPattern[1], 10);
    const target = scenes.find((s) => s.sceneIndex === idx);
    if (target) {
      return {
        filename: cleanName,
        matchedSceneIndex: target.sceneIndex,
        matchedSceneId: target.id,
        expectedFilename: target.expectedFilename,
        reason: `Terdeteksi nomor urut #${target.sceneIndex} di dalam kurung`,
      };
    }
  }

  // 6. Fallback: look for standalone number before extension (e.g. "001.mp4", "..._3.mp4", "...-4.mp4")
  const trailingNum = baseWithoutExt.match(/(?:^|[-_ ])0*(\d+)$/);
  if (trailingNum?.[1]) {
    const idx = parseInt(trailingNum[1], 10);
    const target = scenes.find((s) => s.sceneIndex === idx);
    if (target) {
      return {
        filename: cleanName,
        matchedSceneIndex: target.sceneIndex,
        matchedSceneId: target.id,
        expectedFilename: target.expectedFilename,
        reason: `Terdeteksi urutan angka #${target.sceneIndex} pada akhir nama file`,
      };
    }
  }

  return {
    filename: cleanName,
    matchedSceneIndex: null,
    matchedSceneId: null,
    expectedFilename: null,
    reason:
      "Nama file tidak mengandung nomor bagian. Akan dipetakan sesuai urutan batch unduhan.",
  };
}

export interface BatchItemCandidate {
  file: File | { name: string; lastModified?: number };
  matchedSceneIndex: number | null;
  matchedSceneId: string | null;
  expectedFilename: string | null;
  reason: string;
}

/**
 * Intelligent batch mapper for drag-and-dropped clips:
 * 1. Files with explicit names ("Bagian 1", "SCENE_002", etc.) are mapped first.
 * 2. Unmatched files (e.g. arbitrary Gemini download names like "Boy_pulls_origami_lever.mp4")
 *    are sorted by timestamp / file order and mapped to remaining unfilled scenes in sequence!
 */
export function matchBatchFilesToScenes(
  rawFiles: Array<File | { name: string; lastModified?: number }>,
  scenes: Pick<SceneRecord, "id" | "sceneIndex" | "expectedFilename" | "uploadedClipAssetId">[]
): BatchItemCandidate[] {
  const sortedScenes = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  const results: BatchItemCandidate[] = [];
  const assignedSceneIds = new Set<string>();

  // Pass 1: Match files with explicit scene indicators
  const unassignedFiles: Array<{ item: File | { name: string; lastModified?: number }; origIdx: number }> = [];

  rawFiles.forEach((file, origIdx) => {
    const match = matchFilenameToScene(file.name, sortedScenes);
    if (match.matchedSceneId && !assignedSceneIds.has(match.matchedSceneId)) {
      assignedSceneIds.add(match.matchedSceneId);
      results.push({
        file,
        matchedSceneIndex: match.matchedSceneIndex,
        matchedSceneId: match.matchedSceneId,
        expectedFilename: match.expectedFilename,
        reason: match.reason,
      });
    } else {
      unassignedFiles.push({ item: file, origIdx });
    }
  });

  // Pass 2: Sort remaining unassigned files by lastModified (or drop index)
  unassignedFiles.sort((a, b) => {
    const timeA = "lastModified" in a.item && typeof a.item.lastModified === "number" ? a.item.lastModified : a.origIdx;
    const timeB = "lastModified" in b.item && typeof b.item.lastModified === "number" ? b.item.lastModified : b.origIdx;
    return timeA - timeB;
  });

  // Determine which scenes are still unassigned: first prefer scenes with no clip, then any remaining scene
  const unfilledScenes = sortedScenes.filter((sc) => !assignedSceneIds.has(sc.id));

  unassignedFiles.forEach(({ item }) => {
    const targetScene = unfilledScenes.shift();
    if (targetScene) {
      assignedSceneIds.add(targetScene.id);
      results.push({
        file: item,
        matchedSceneIndex: targetScene.sceneIndex,
        matchedSceneId: targetScene.id,
        expectedFilename: targetScene.expectedFilename,
        reason: `Dipetakan otomatis ke Bagian #${targetScene.sceneIndex} berdasarkan urutan batch unduhan`,
      });
    } else {
      results.push({
        file: item,
        matchedSceneIndex: null,
        matchedSceneId: null,
        expectedFilename: null,
        reason: "Semua bagian sudah terisi. File ini berlebih.",
      });
    }
  });

  // Sort final results by matchedSceneIndex asc (unmapped at end)
  return results.sort((a, b) => {
    if (a.matchedSceneIndex === null) return 1;
    if (b.matchedSceneIndex === null) return -1;
    return a.matchedSceneIndex - b.matchedSceneIndex;
  });
}

/**
 * Evaluates all scenes and uploaded clip assets for a content item to detect
 * missing scenes, duplicate clip uploads per scene, and readiness for FFmpeg assembly.
 */
export function evaluateClipCompleteness(
  scenes: Pick<
    SceneRecord,
    "id" | "sceneIndex" | "expectedFilename" | "uploadedClipAssetId"
  >[],
  clipAssets: Pick<
    AssetRecord,
    "id" | "sceneId" | "originalFilename" | "assetType"
  >[]
): ClipCompletenessReport {
  const sceneVideoAssets = clipAssets.filter(
    (a) => a.assetType === "scene_video"
  );

  const countBySceneIndex = new Map<number, number>();
  const unmappedFilenames: string[] = [];

  for (const sc of scenes) {
    countBySceneIndex.set(sc.sceneIndex, 0);
  }

  for (const asset of sceneVideoAssets) {
    const targetScene = scenes.find(
      (s) => s.id === asset.sceneId || s.uploadedClipAssetId === asset.id
    );
    if (targetScene) {
      countBySceneIndex.set(
        targetScene.sceneIndex,
        (countBySceneIndex.get(targetScene.sceneIndex) ?? 0) + 1
      );
    } else {
      unmappedFilenames.push(asset.originalFilename);
    }
  }

  const missingSceneIndices: number[] = [];
  const missingExpectedFilenames: string[] = [];
  const duplicateSceneIndices: number[] = [];
  let uploadedSceneCount = 0;

  for (const sc of scenes) {
    const count = countBySceneIndex.get(sc.sceneIndex) ?? 0;
    if (count === 0 && !sc.uploadedClipAssetId) {
      missingSceneIndices.push(sc.sceneIndex);
      missingExpectedFilenames.push(sc.expectedFilename);
    } else {
      uploadedSceneCount++;
      if (count > 1) {
        duplicateSceneIndices.push(sc.sceneIndex);
      }
    }
  }

  const readyForAssembly =
    scenes.length > 0 &&
    missingSceneIndices.length === 0 &&
    duplicateSceneIndices.length === 0;

  return {
    readyForAssembly,
    totalScenes: scenes.length,
    uploadedSceneCount,
    missingSceneIndices,
    missingExpectedFilenames,
    duplicateSceneIndices,
    unmappedFilenames,
  };
}
