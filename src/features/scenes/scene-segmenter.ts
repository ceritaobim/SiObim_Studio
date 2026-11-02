import type {
  SceneRecord,
  TimestampStatus,
  WordAlignmentSpan,
} from "@/types/domain";
import crypto from "crypto";

export interface SegmentationOptions {
  contentId: string;
  contentCode: string;
  narrationText: string;
  wordSpans?: WordAlignmentSpan[];
  timestampStatus: TimestampStatus;
  totalAudioDurationMs?: number;
  minSceneSeconds?: number;
  maxSceneSeconds?: number;
}

export interface SceneValidationReport {
  valid: boolean;
  textCoverageValid: boolean;
  timestampsOrdered: boolean;
  noNegativeOrZeroDurations: boolean;
  overlongSceneIndices: number[];
  shortSceneIndices: number[];
  gapWarnings: string[];
  errors: string[];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Splits narration into natural clause/sentence units while preserving every single character/word.
 */
export function splitNarrationIntoClauses(narration: string): string[] {
  const normalized = normalizeWhitespace(narration);
  if (!normalized) return [];

  // Split after sentence/clause punctuation (. ! ? ; : , —) followed by space
  const rawParts = normalized.split(/(?<=[.!?;:,—])\s+/);
  const clauses: string[] = [];

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    // If a single clause without punctuation is very long (> 22 words), split gently at ~14 words
    const words = trimmed.split(/\s+/);
    if (words.length > 22) {
      for (let i = 0; i < words.length; i += 14) {
        clauses.push(words.slice(i, i + 14).join(" "));
      }
    } else {
      clauses.push(trimmed);
    }
  }

  return clauses;
}

/**
 * Builds estimated word-level alignment spans when actual TTS/forced-alignment timestamps are unavailable.
 * Always labeled `estimated` (`ESTIMATED`) — never claims to be actual audio alignment.
 */
export function buildEstimatedWordSpans(
  narration: string,
  totalAudioDurationMs?: number
): WordAlignmentSpan[] {
  const words = normalizeWhitespace(narration)
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  // Default speaking rate in Indonesian narration: ~2.3 words/sec (~435ms per word)
  const effectiveTotalMs =
    totalAudioDurationMs && totalAudioDurationMs >= words.length * 150
      ? totalAudioDurationMs
      : words.length * 435;

  const totalChars = words.reduce((acc, w) => acc + Math.max(w.length, 2), 0);
  const spans: WordAlignmentSpan[] = [];
  let cursorMs = 0;

  words.forEach((word, idx) => {
    const weight = Math.max(word.length, 2) / totalChars;
    const rawDuration = Math.max(120, Math.round(effectiveTotalMs * weight));
    const endMs =
      idx === words.length - 1
        ? effectiveTotalMs
        : Math.min(effectiveTotalMs - (words.length - 1 - idx) * 50, cursorMs + rawDuration);
    const safeEnd = Math.max(cursorMs + 50, endMs);

    spans.push({
      word,
      startMs: cursorMs,
      endMs: safeEnd,
    });
    cursorMs = safeEnd;
  });

  return spans;
}

/**
 * Segments narration into sequential scenes targeting `minSceneSeconds`–`maxSceneSeconds` (default 6–10s)
 * around natural sentence/clause boundaries. Never drops or duplicates narration words.
 */
export function segmentNarrationIntoScenes(
  options: SegmentationOptions
): SceneRecord[] {
  const minMs = (options.minSceneSeconds ?? 6) * 1000;
  const maxMs = (options.maxSceneSeconds ?? 10) * 1000;
  const targetIdealMs = Math.round((minMs + maxMs) / 2);

  const normalizedNarration = normalizeWhitespace(options.narrationText);
  if (!normalizedNarration) {
    return [];
  }

  const spans =
    options.wordSpans && options.wordSpans.length > 0
      ? options.wordSpans
      : buildEstimatedWordSpans(
          normalizedNarration,
          options.totalAudioDurationMs
        );

  const clauses = splitNarrationIntoClauses(normalizedNarration);

  // Map each clause to its corresponding slice of wordSpans
  interface ClauseSpanGroup {
    text: string;
    startMs: number;
    endMs: number;
  }

  const clauseGroups: ClauseSpanGroup[] = [];
  let spanCursor = 0;

  for (const clause of clauses) {
    const clauseWords = clause.split(/\s+/).filter(Boolean);
    const wordCount = clauseWords.length;
    const slice = spans.slice(spanCursor, spanCursor + wordCount);
    spanCursor += wordCount;

    const firstSpan = slice[0] ?? spans[spans.length - 1];
    const lastSpan = slice[slice.length - 1] ?? firstSpan;

    clauseGroups.push({
      text: clauseWords.join(" "),
      startMs: firstSpan ? firstSpan.startMs : 0,
      endMs: lastSpan ? lastSpan.endMs : 1000,
    });
  }

  // Strict time-based grouping: target exactly 10s (10,000ms) per scene,
  // regardless of whether the sentence is finished or not (mid-sentence cuts allowed).
  const targetSceneMs = 10000;
  const rawScenes: Array<{ text: string; startMs: number; endMs: number }> = [];

  let sceneWords: string[] = [];
  let sceneStartMs = spans[0]?.startMs ?? 0;
  let sceneLastEndMs = sceneStartMs;

  for (let i = 0; i < spans.length; i++) {
    const s = spans[i]!;
    sceneWords.push(s.word);
    sceneLastEndMs = s.endMs;

    const currentSpanDuration = sceneLastEndMs - sceneStartMs;
    const isLastWord = i === spans.length - 1;

    // Cut at 10 seconds or when reaching the end of the transcript
    if (currentSpanDuration >= targetSceneMs || isLastWord) {
      rawScenes.push({
        text: sceneWords.join(" "),
        startMs: sceneStartMs,
        endMs: sceneLastEndMs,
      });

      if (!isLastWord) {
        sceneWords = [];
        sceneStartMs = sceneLastEndMs;
      }
    }
  }

  const now = new Date().toISOString();
  return rawScenes.map((sc, idx) => {
    const sceneIndex = idx + 1;
    const durationMs = sc.endMs - sc.startMs;
    const durationFlag: SceneRecord["durationFlag"] =
      durationMs < minMs
        ? "too_short"
        : durationMs > maxMs
        ? "too_long"
        : "ok";

    const paddedIdx = String(sceneIndex).padStart(3, "0");
    const expectedFilename = `${options.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;

    return {
      id: crypto.randomUUID(),
      contentId: options.contentId,
      sceneIndex,
      startMs: sc.startMs,
      endMs: sc.endMs,
      durationMs,
      narrationText: sc.text,
      visualAction: `Karakter kertas origami memperagakan adegan untuk segmen #${sceneIndex}: "${sc.text.slice(
        0,
        90
      )}"`,
      cameraDirection:
        sceneIndex === 1
          ? "Medium close-up kertas lipat dengan gerakan stop-motion cepat di 3 detik pertama (hook)"
          : "Eye-level diorama kertas origami dengan transisi lipatan kertas halus",
      continuityNotes:
        sceneIndex === 1
          ? "Adegan pembuka: perkenalkan karakter utama dan latar kertas lipat."
          : `Lanjutkan pencahayaan, warna kertas, dan posisi karakter dari Scene #${
              sceneIndex - 1
            }.`,
      promptText: "",
      expectedFilename,
      timestampStatus: options.timestampStatus,
      sceneStatus: "segmented",
      durationFlag,
      uploadedClipAssetId: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Validates scene timestamp ordering, positive durations, and 100% narration text coverage.
 */
export function validateScenesIntegrity(
  originalNarration: string,
  scenes: Pick<
    SceneRecord,
    "sceneIndex" | "startMs" | "endMs" | "narrationText"
  >[],
  minSceneSeconds = 6,
  maxSceneSeconds = 10
): SceneValidationReport {
  const errors: string[] = [];
  const gapWarnings: string[] = [];
  const overlongSceneIndices: number[] = [];
  const shortSceneIndices: number[] = [];

  if (scenes.length === 0) {
    return {
      valid: false,
      textCoverageValid: false,
      timestampsOrdered: false,
      noNegativeOrZeroDurations: false,
      overlongSceneIndices: [],
      shortSceneIndices: [],
      gapWarnings: [],
      errors: ["Daftar scene kosong."],
    };
  }

  let timestampsOrdered = true;
  let noNegativeOrZeroDurations = true;

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i]!;
    if (sc.sceneIndex !== i + 1) {
      timestampsOrdered = false;
      errors.push(
        `Urutan sceneIndex tidak berurutan pada indeks ${i} (ditemukan ${sc.sceneIndex}, seharusnya ${
          i + 1
        }).`
      );
    }

    if (sc.startMs < 0 || sc.endMs <= sc.startMs) {
      noNegativeOrZeroDurations = false;
      errors.push(
        `Scene #${sc.sceneIndex} memiliki timestamp tidak valid (${sc.startMs}ms – ${sc.endMs}ms). Wajib start_ms < end_ms.`
      );
    }

    const durationMs = sc.endMs - sc.startMs;
    if (durationMs > maxSceneSeconds * 1000) {
      overlongSceneIndices.push(sc.sceneIndex);
    } else if (durationMs < minSceneSeconds * 1000) {
      shortSceneIndices.push(sc.sceneIndex);
    }

    if (i > 0) {
      const prev = scenes[i - 1]!;
      if (sc.startMs < prev.endMs) {
        timestampsOrdered = false;
        errors.push(
          `Scene #${sc.sceneIndex} tumpang tindih (overlap) dengan Scene #${prev.sceneIndex} (${sc.startMs}ms < ${prev.endMs}ms).`
        );
      } else if (sc.startMs - prev.endMs > 250) {
        gapWarnings.push(
          `Terdapat jeda ${sc.startMs - prev.endMs}ms antara Scene #${
            prev.sceneIndex
          } dan Scene #${sc.sceneIndex}.`
        );
      }
    }
  }

  const normalizedOriginal = normalizeWhitespace(originalNarration);
  const reconstructed = normalizeWhitespace(
    scenes.map((s) => s.narrationText).join(" ")
  );

  const textCoverageValid = normalizedOriginal === reconstructed;
  if (!textCoverageValid) {
    errors.push(
      "Cakupan teks narasi pada scene tidak sama persis dengan narasi asli (ada kata yang hilang, berubah, atau terduplikasi)."
    );
  }

  return {
    valid:
      textCoverageValid && timestampsOrdered && noNegativeOrZeroDurations,
    textCoverageValid,
    timestampsOrdered,
    noNegativeOrZeroDurations,
    overlongSceneIndices,
    shortSceneIndices,
    gapWarnings,
    errors,
  };
}
