import "server-only";
import fs from "fs";
import crypto from "crypto";
import type { SceneRecord, TimestampStatus } from "@/types/domain";
import { getActiveProviderProfile } from "@/lib/providers/account-profiles";
import { segmentNarrationIntoScenes } from "@/features/scenes/scene-segmenter";

export interface TranscribedAudioPart {
  partIndex: number;
  startSec: number;
  endSec: number;
  text: string;
  visualAction?: string;
}

function cleanInlineTimestampMarkers(text: string): string {
  return text
    .replace(/\b\d{1,3}\s*[-–]\s*\d{1,3}\s*(?:s|detik)?\s*:\s*/gi, "")
    .replace(/\[\s*\d{1,3}\s*[-–]\s*\d{1,3}\s*(?:s|detik)?\s*\]\s*:?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects silence pauses in 16-bit PCM WAV audio buffers
 */
export function detectAudioSilencePauses(
  buf?: Buffer,
  minPauseSec = 0.22
): { start: number; end: number; dur: number }[] {
  if (
    buf &&
    buf.length > 44 &&
    buf.toString("utf8", 0, 4) === "RIFF" &&
    buf.toString("utf8", 8, 12) === "WAVE"
  ) {
    try {
      const sampleRate = buf.readUInt32LE(24);
      const channels = buf.readUInt16LE(22);
      const bitsPerSample = buf.readUInt16LE(34);
      if (channels === 1 && bitsPerSample === 16 && sampleRate > 0) {
        const samples = new Int16Array(
          buf.buffer,
          buf.byteOffset + 44,
          Math.floor((buf.length - 44) / 2)
        );
        const windowSize = Math.floor(sampleRate * 0.08); // 80ms windows
        const silences: { start: number; end: number; dur: number }[] = [];
        let inSilence = false;
        let silenceStart = 0;

        for (let i = 0; i < samples.length; i += windowSize) {
          let sum = 0;
          const end = Math.min(samples.length, i + windowSize);
          for (let j = i; j < end; j++) sum += Math.abs(samples[j]!);
          const avg = sum / (end - i);
          const sec = i / sampleRate;

          if (avg < 450) {
            if (!inSilence) {
              inSilence = true;
              silenceStart = sec;
            }
          } else {
            if (inSilence) {
              inSilence = false;
              const dur = sec - silenceStart;
              if (dur >= minPauseSec) {
                silences.push({
                  start: Math.round(silenceStart * 10) / 10,
                  end: Math.round(sec * 10) / 10,
                  dur: Math.round(dur * 10) / 10,
                });
              }
            }
          }
        }
        return silences;
      }
    } catch {
      // ignore parsing errors
    }
  }
  return [];
}

/**
 * Listens to the actual generated MP3/WAV audio buffer (or file path) using Gemini
 * and aligns it into sequential parts of <= 10 seconds (`Bagian 1 [0-9] : ...`, `Bagian 2 [10-19] : ...`)
 * so that sentences are never cut off mid-word and timestamps match actual narration audio.
 */
export async function transcribeAndSegmentAudioFile(params: {
  contentId: string;
  contentCode: string;
  fallbackNarrationText: string;
  audioBuffer?: Buffer;
  audioFilePath?: string;
  mimeType: string;
  totalDurationMs: number;
  overrideProfileId?: string;
}): Promise<{
  scenes: SceneRecord[];
  transcriptFormattedText: string;
  usedAiTranscription: boolean;
}> {
  const totalSec = Math.max(5, Math.round(params.totalDurationMs / 1000));
  let buffer = params.audioBuffer;
  if (!buffer && params.audioFilePath && fs.existsSync(params.audioFilePath)) {
    buffer = fs.readFileSync(params.audioFilePath);
  }

  const cleanScript = cleanInlineTimestampMarkers(params.fallbackNarrationText);
  const detectedPauses = detectAudioSilencePauses(buffer);

  const profile = getActiveProviderProfile(params.overrideProfileId);
  const geminiKey = (
    profile.geminiApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();

  if (buffer && buffer.length > 100 && geminiKey) {
    try {
      const pauseHints =
        detectedPauses.length > 0
          ? `\nTITIK-TITIK JEDA SENYAP SUARA DI AUDIO (Detik): [${detectedPauses
              .map((p) => `${p.start}s-${p.end}s`)
              .join(", ")}]. Gunakan jeda ini sebagai patokan pemotongan.`
          : "";

      const prompt = [
        `Dengarkan file audio narasi Bahasa Indonesia ini secara teliti dan seksama (total durasi ${totalSec} detik).`,
        `Berikut adalah naskah narasi yang dibacakan pada audio:\n"""\n${cleanScript}\n"""`,
        `Tugas Utama: Lakukan AUDIO ALIGNMENT yang SANGAT PRESISI antara naskah dan suara di audio.${pauseHints}`,
        `ATURAN KUNCI TIMESTAMP:`,
        `- Deteksi detik awal (startSec) tepat saat kata pertama diucapkan. JANGAN memotong di tengah kata!`,
        `- Deteksi detik akhir (endSec) saat kata terakhir di bagian tersebut selesai diucapkan.`,
        `- Setiap bagian WAJIB memiliki durasi MAKSIMAL 10 DETIK (endSec - startSec <= 10.0 detik).`,
        `- Pastikan seluruh naskah tercakup 100% berurutan dari detik 0 sampai akhir audio (${totalSec}s).`,
        `Untuk setiap bagian berikan juga visualAction origami stop-motion (Obim) dan sfxCue pendek.`,
        `Kembalikan HANYA JSON array berisi objek: { "partIndex": number, "startSec": number, "endSec": number, "text": string, "visualAction": string, "sfxCue": string }`,
      ].join("\n");

      // Try gemini models in order: gemini-3.8-flash -> gemini-3-flash-preview -> gemini-flash-latest
      const candidateModels = [
        "gemini-3.8-flash",
        "gemini-3-flash-preview",
        "gemini-flash-latest",
      ];
      let parsed: TranscribedAudioPart[] | null = null;

      for (const model of candidateModels) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
            geminiKey
          )}`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: params.mimeType.includes("wav")
                          ? "audio/wav"
                          : "audio/mpeg",
                        data: buffer.toString("base64"),
                      },
                    },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
          });

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };
            const rawJson =
              data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            const json = JSON.parse(rawJson);
            if (Array.isArray(json) && json.length > 0) {
              parsed = json as TranscribedAudioPart[];
              break;
            }
          }
        } catch {
          // try next model
        }
      }

      if (parsed && parsed.length > 0) {
        const now = new Date().toISOString();
        let cursorMs = 0;

        const scenes: SceneRecord[] = parsed.map((part, idx) => {
          const sceneIndex = idx + 1;
          const rawStart = Number(part.startSec ?? cursorMs / 1000);
          const rawEnd = Number(part.endSec ?? rawStart + 5);

          const startMs = idx === 0 ? 0 : cursorMs;
          let endMs = Math.round(rawEnd * 1000);
          if (endMs <= startMs) {
            endMs = startMs + 3000;
          }
          if (endMs - startMs > 10000) {
            endMs = startMs + 10000;
          }
          if (idx === parsed!.length - 1) {
            endMs = Math.max(startMs + 1000, Math.round(params.totalDurationMs));
          }
          cursorMs = endMs;
          const durationMs = endMs - startMs;
          const paddedIdx = String(sceneIndex).padStart(3, "0");

          return {
            id: crypto.randomUUID(),
            contentId: params.contentId,
            sceneIndex,
            startMs,
            endMs,
            durationMs,
            narrationText: cleanInlineTimestampMarkers(String(part.text ?? "")),
            visualAction:
              String(part.visualAction ?? "").trim() ||
              `Karakter origami Obim memperagakan adegan Bagian ${sceneIndex} dalam dunia kertas lipat stop-motion tanpa teks.`,
            sfxCue:
              String((part as { sfxCue?: string }).sfxCue ?? "").trim() ||
              undefined,
            cameraDirection:
              sceneIndex === 1
                ? "Vertical 9:16 medium close-up stop-motion hook"
                : "Vertical 9:16 smooth folded-paper diorama transition",
            continuityNotes:
              sceneIndex === 1
                ? "Adegan pembuka diorama kertas origami."
                : `Melanjutkan visual dan pencahayaan kertas dari Bagian ${
                    sceneIndex - 1
                  }.`,
            promptText: "",
            expectedFilename: `${params.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`,
            timestampStatus: "actual" as TimestampStatus,
            sceneStatus: "segmented",
            durationFlag:
              durationMs > 10000
                ? "too_long"
                : durationMs < 4000
                ? "too_short"
                : "ok",
            uploadedClipAssetId: null,
            createdAt: now,
            updatedAt: now,
          };
        });

        return {
          scenes,
          transcriptFormattedText: formatBagianTranscriptText(scenes),
          usedAiTranscription: true,
        };
      }
    } catch {
      // Fall back to deterministic alignment below
    }
  }

  // Fallback segmentation (guarantees <= 10s per part and contiguous timestamps)
  const rawFallback = segmentNarrationIntoScenes({
    contentId: params.contentId,
    contentCode: params.contentCode,
    narrationText: cleanScript,
    timestampStatus: "estimated",
    totalAudioDurationMs: params.totalDurationMs,
    minSceneSeconds: 5,
    maxSceneSeconds: 9,
  });

  let cursorMs = 0;
  const normalizedScenes = rawFallback.map((sc, idx) => {
    const rawDur = Math.max(
      3000,
      Math.min(9000, Math.round(sc.durationMs / 1000) * 1000)
    );
    const startMs = idx === 0 ? 0 : cursorMs;
    const endMs =
      idx === rawFallback.length - 1
        ? Math.max(startMs + 1000, Math.round(params.totalDurationMs))
        : Math.min(startMs + 9500, startMs + rawDur);
    cursorMs = endMs;

    return {
      ...sc,
      sceneIndex: idx + 1,
      startMs,
      endMs,
      durationMs: endMs - startMs,
    };
  });

  return {
    scenes: normalizedScenes,
    transcriptFormattedText: formatBagianTranscriptText(normalizedScenes),
    usedAiTranscription: false,
  };
}

/**
 * Formats scenes into the exact transcript format requested by user:
 * Bagian 1 [0-9] : Lorem ipsum ...
 * Bagian 2 [10-19] : Lorem ipsum ...
 */
export function formatBagianTranscriptText(
  scenes: Pick<SceneRecord, "sceneIndex" | "startMs" | "endMs" | "narrationText">[]
): string {
  return [...scenes]
    .sort((a, b) => a.sceneIndex - b.sceneIndex)
    .map((sc) => {
      const startSec = Math.round(sc.startMs / 1000);
      const endSec = Math.round(sc.endMs / 1000);
      return `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] : ${sc.narrationText}`;
    })
    .join("\n\n");
}
