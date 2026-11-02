import crypto from "crypto";
import type { TimestampStatus, WordAlignmentSpan } from "@/types/domain";
import { buildEstimatedWordSpans } from "@/features/scenes/scene-segmenter";

export interface TTSInput {
  contentId: string;
  contentCode: string;
  narrationText: string;
  voiceId?: string;
}

export interface TTSResult {
  providerKey: string;
  providerModel: string;
  voiceId: string;
  providerRequestId: string;
  audioBuffer: Buffer;
  mimeType: string;
  durationMs: number;
  wordSpans: WordAlignmentSpan[];
  timestampStatus: TimestampStatus;
  estimatedCostUsd: number;
}

export interface TTSProvider {
  readonly providerKey: string;
  readonly modelName: string;
  synthesize(input: TTSInput): Promise<TTSResult>;
}

/**
 * Generates a small valid WAV audio buffer (sine tone pulse) for local development/testing
 * when no ElevenLabs API key is configured, while clearly labeling timestamps as `estimated`
 * unless real alignment data is supplied.
 */
function buildSilentOrToneWavBuffer(durationSeconds = 5): Buffer {
  const sampleRate = 8000;
  const numSamples = Math.max(8000, Math.min(durationSeconds, 10) * sampleRate);
  const dataSize = numSamples;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate, 28); // Byte rate
  buffer.writeUInt16LE(1, 32); // Block align
  buffer.writeUInt16LE(8, 34); // 8-bit unsigned
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    // Soft 440Hz tone at low amplitude around midpoint 128
    const t = i / sampleRate;
    const envelope = i % 4000 < 2500 ? 12 : 0;
    buffer[44 + i] = 128 + Math.round(Math.sin(2 * Math.PI * 440 * t) * envelope);
  }

  return buffer;
}

/**
 * Strips scene time-range headers like "0-10:", "11-20s:", "[0-10]" from narration text
 * before sending it to ElevenLabs so the voice narrator never speaks "nol sampai sepuluh".
 */
export function cleanNarrationForSpeech(rawNarration: string): string {
  return rawNarration
    .replace(
      /(?:^|\n)\s*\[?\d{1,3}\s*(?:-|–|—|s\/d|sampai|to)\s*\d{1,3}\s*(?:s|sec|detik)?\]?\s*:?\s*(?=\n|$)/gi,
      "\n"
    )
    .replace(
      /(?:^|\n)\s*\[?\d{1,3}\s*(?:-|–|—)\s*\d{1,3}\s*(?:s|sec|detik)?\]?\s*:\s*/gi,
      "\n"
    )
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

export class MockTTSProvider implements TTSProvider {
  readonly providerKey = "mock_tts";
  readonly modelName = "ceritaobim-mock-voice-v1";

  async synthesize(input: TTSInput): Promise<TTSResult> {
    const cleanText = cleanNarrationForSpeech(input.narrationText);
    const wordSpans = buildEstimatedWordSpans(cleanText);
    const durationMs =
      wordSpans.length > 0 ? wordSpans[wordSpans.length - 1]!.endMs : 5000;

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      voiceId: input.voiceId || "id-ID-mock-narrator",
      providerRequestId: `mock-tts-${crypto.randomUUID().slice(0, 8)}`,
      audioBuffer: buildSilentOrToneWavBuffer(Math.round(durationMs / 1000)),
      mimeType: "audio/wav",
      durationMs,
      wordSpans,
      timestampStatus: "estimated",
      estimatedCostUsd: 0,
    };
  }
}

/**
 * Converts ElevenLabs character-level alignment arrays (`characters`, `character_start_times_seconds`, `character_end_times_seconds`)
 * into word-level `WordAlignmentSpan[]`.
 */
export function convertCharacterAlignmentToWordSpans(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): WordAlignmentSpan[] {
  const {
    characters,
    character_start_times_seconds: starts,
    character_end_times_seconds: ends,
  } = alignment;

  const spans: WordAlignmentSpan[] = [];
  let currentChars = "";
  let wordStartSec: number | null = null;
  let wordEndSec = 0;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i] ?? "";
    const st = starts[i] ?? wordEndSec;
    const en = ends[i] ?? st;

    if (/\s/.test(ch)) {
      if (currentChars.length > 0 && wordStartSec !== null) {
        spans.push({
          word: currentChars,
          startMs: Math.round(wordStartSec * 1000),
          endMs: Math.max(Math.round(wordStartSec * 1000) + 20, Math.round(wordEndSec * 1000)),
        });
        currentChars = "";
        wordStartSec = null;
      }
    } else {
      if (wordStartSec === null) {
        wordStartSec = st;
      }
      currentChars += ch;
      wordEndSec = en;
    }
  }

  if (currentChars.length > 0 && wordStartSec !== null) {
    spans.push({
      word: currentChars,
      startMs: Math.round(wordStartSec * 1000),
      endMs: Math.max(Math.round(wordStartSec * 1000) + 20, Math.round(wordEndSec * 1000)),
    });
  }

  return spans;
}

export interface ElevenLabsFreeVoiceOption {
  id: string;
  name: string;
  gender: "male" | "female" | "neutral";
  characterFit: string;
  previewUrl: string;
}

export const ELEVENLABS_FREE_PREMADE_VOICES: ElevenLabsFreeVoiceOption[] = [
  {
    id: "gemini-kid-puck-bold",
    name: "Puck Bold (Gemini AI) — Anak Laki-Laki Optimis, Semangat & Bold",
    gender: "male",
    characterFit:
      "Protagonis anak laki-laki 10 tahun yang lantang (bold), optimis, penuh semangat petualangan (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/bold-boy-puck.wav",
  },
  {
    id: "gemini-kid-fenrir-bold",
    name: "Fenrir Bold (Gemini AI) — Anak Laki-Laki Tegas, Berani & Energik",
    gender: "male",
    characterFit:
      "Suara anak laki-laki tegas, berani (bold), power kuat & bersemangat tinggi (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/bold-boy-fenrir.wav",
  },
  {
    id: "gemini-kid-orus-bold",
    name: "Orus Bold (Gemini AI) — Anak Laki-Laki Cerdas, Percaya Diri & Lugas",
    gender: "male",
    characterFit:
      "Suara anak laki-laki percaya diri, artikulasi tegas, optimis menjelaskan fakta (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/bold-boy-orus.wav",
  },
  {
    id: "gemini-kid-charon-bold",
    name: "Charon Bold (Gemini AI) — Anak Laki-Laki Antusias & Berwibawa Muda",
    gender: "male",
    characterFit:
      "Suara anak laki-laki berkarakter kuat, hangat, optimis & dinamis (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/bold-boy-charon.wav",
  },
  {
    id: "IKne3meq5aSn9XLyUdCD",
    name: "Charlie Bold (ElevenLabs Free) — Laki-Laki Muda Hyped, Tegas & Semangat",
    gender: "male",
    characterFit:
      "Vokal laki-laki muda paling bold/hyped di ElevenLabs, penuh energi & percaya diri tinggi",
    previewUrl:
      "http://localhost:3000/voice-samples/bold-eleven-IKne3meq5aSn9XLyUdCD.mp3",
  },
  {
    id: "TX3LPaxmHKxFdv7VOQHJ",
    name: "Liam Bold (ElevenLabs Free) — Laki-Laki Muda Optimis & Kreator Energik",
    gender: "male",
    characterFit:
      "Suara laki-laki muda lantang, optimis, cepat & berdinamika tinggi",
    previewUrl:
      "http://localhost:3000/voice-samples/bold-eleven-TX3LPaxmHKxFdv7VOQHJ.mp3",
  },
  {
    id: "bIHbv24MWmeRgasZH58o",
    name: "Will Bold (ElevenLabs Free) — Laki-Laki Muda Optimistis & Ceria",
    gender: "male",
    characterFit:
      "Sesuai julukannya 'Relaxed Optimist' dengan gaya bicara penuh semangat & ramah",
    previewUrl:
      "http://localhost:3000/voice-samples/bold-eleven-bIHbv24MWmeRgasZH58o.mp3",
  },
  {
    id: "N2lVS1w4EtoT3dr4eOWO",
    name: "Callum Bold (ElevenLabs Free) — Karakter Kartun Laki-Laki Unik & Berani",
    gender: "male",
    characterFit:
      "Suara karakter kartun/animasi laki-laki yang unik, ekspresif & berani",
    previewUrl:
      "http://localhost:3000/voice-samples/bold-eleven-N2lVS1w4EtoT3dr4eOWO.mp3",
  },
  {
    id: "cgSgspJ2msm6clMCkdW9",
    name: "Jessica — Suara Anak Kecil / Karakter Kartun Imut (ElevenLabs Free)",
    gender: "female",
    characterFit:
      "Karakter anak kecil animasi (seperti pengisi suara Naruto/Luffy/Conan), ceria & imut",
    previewUrl:
      "http://localhost:3000/voice-samples/eleven-cgSgspJ2msm6clMCkdW9.mp3",
  },
  {
    id: "FGY2WhTYpPnrIDTdsKH5",
    name: "Laura — Suara Anak Kecil Antusias & Aktif (ElevenLabs Free)",
    gender: "female",
    characterFit: "Karakter anak kecil ekspresif, lincah, antusias bercerita",
    previewUrl:
      "http://localhost:3000/voice-samples/eleven-FGY2WhTYpPnrIDTdsKH5.mp3",
  },
  {
    id: "gemini-kid-leda",
    name: "Leda (Gemini AI) — Suara Anak Kecil Polos & Imut",
    gender: "neutral",
    characterFit:
      "Suara anak kecil polos, ramah, nada tinggi khas kartun origami (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/obim-kid-leda.wav",
  },
  {
    id: "gemini-kid-zephyr",
    name: "Zephyr (Gemini AI) — Suara Anak Kecil Cerdas & Bersemangat",
    gender: "neutral",
    characterFit:
      "Suara anak kecil bercerita fakta seru dengan intonasi dinamis (Tanpa Kuota ElevenLabs)",
    previewUrl: "http://localhost:3000/voice-samples/obim-kid-zephyr.wav",
  },
  {
    id: "SOYHLrjzK2X1ezoPC6cr",
    name: "Harry — Fierce Warrior (Karakter Animasi Remaja/Dewasa)",
    gender: "male",
    characterFit: "Suara karakter animasi dramatis",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/SOYHLrjzK2X1ezoPC6cr/86d178f6-f4b6-4e0e-85be-3de19f490794.mp3",
  },
  {
    id: "iP95p4xoKVk53GoZ742B",
    name: "Chris — Charming, Down-to-Earth",
    gender: "male",
    characterFit: "Kasual, ramah, membumi",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/iP95p4xoKVk53GoZ742B/3f4bde72-cc48-40dd-829f-57fbf906f4d7.mp3",
  },
  {
    id: "JBFqnCBsd6RMkjVDRZzb",
    name: "George — Warm, Captivating Storyteller",
    gender: "male",
    characterFit: "Pendongeng hangat, tenang, berwibawa",
    previewUrl:
      "https://api.us.elevenlabs.io/v1/voices/JBFqnCBsd6RMkjVDRZzb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiJlNjIwNmQxYS0wNzIxLTQ3ODctYWFmYi0wNmE2ZTcwNWNhYzUubXAzIiwidGltZXN0YW1wIjoxNzkyNDA3NjAwMDAwMDAwfQ%3D%3D",
  },
  {
    id: "cjVigY5qzO86Huf0OWal",
    name: "Eric — Smooth, Trustworthy",
    gender: "male",
    characterFit: "Halus, meyakinkan, cocok untuk edukasi/fakta",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/cjVigY5qzO86Huf0OWal/d098fda0-6456-4030-b3d8-63aa048c9070.mp3",
  },
  {
    id: "CwhRBWXzGAHq8TQ4Fs17",
    name: "Roger — Laid-Back, Casual, Resonant",
    gender: "male",
    characterFit: "Santai, suara agak berat & resonan",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/CwhRBWXzGAHq8TQ4Fs17/58ee3ff5-f6f2-4628-93b8-e38eb31806b0.mp3",
  },
  {
    id: "nPczCjzI2devNBz1zQrb",
    name: "Brian — Deep, Resonant and Comforting",
    gender: "male",
    characterFit: "Suara berat menenangkan, narator dokumenter",
    previewUrl:
      "https://api.us.elevenlabs.io/v1/voices/nPczCjzI2devNBz1zQrb/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiIyZGQzZTcyYy00ZmQzLTQyZjEtOTNlYS1hYmM1ZDRlNWFhMWQubXAzIiwidGltZXN0YW1wIjoxNzkyNDA3NjAwMDAwMDAwfQ%3D%3D",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    name: "Daniel — Steady Broadcaster",
    gender: "male",
    characterFit: "Pembawa berita rapi, stabil, jelas",
    previewUrl:
      "https://api.us.elevenlabs.io/v1/voices/onwK4e9ZLuTAKqWW03F9/previews/audio?payload=eyJ2b2ljZV9zb3VyY2UiOiJwcmVtYWRlIiwiZmlsZW5hbWUiOiI3ZWVlMDIzNi0xYTcyLTRiODYtYjMwMy01ZGNhZGMwMDdiYTkubXAzIiwidGltZXN0YW1wIjoxNzkyNDA3NjAwMDAwMDAwfQ%3D%3D",
  },
  {
    id: "pNInz6obpgDQGcFmaJgB",
    name: "Adam — Dominant, Firm",
    gender: "male",
    characterFit: "Tegas, serius, vokal kuat",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/d6905d7a-dd26-4187-bfff-1bd3a5ea7cac.mp3",
  },
  {
    id: "pqHfZKP75CvOlQylNhV4",
    name: "Bill — Wise, Mature, Balanced",
    gender: "male",
    characterFit: "bijaksana, dewasa/senior",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/d782b3ff-84ba-4029-84f8-acf01285524d.mp3",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    name: "Sarah — Mature, Reassuring, Confident",
    gender: "female",
    characterFit: "Perempuan tenang, menenangkan, percaya diri",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3",
  },
  {
    id: "Xb7hH8MSUJpSbSDYk0k2",
    name: "Alice — Clear, Engaging Educator",
    gender: "female",
    characterFit: "Edukator perempuan, artikulasi sangat jelas",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/Xb7hH8MSUJpSbSDYk0k2/d10f7534-11f6-41fe-a012-2de1e482d336.mp3",
  },
  {
    id: "XrExE9yKIg1WjnnlVkGX",
    name: "Matilda — Knowledgeable, Professional",
    gender: "female",
    characterFit: "Profesional, pintar, informatif",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/XrExE9yKIg1WjnnlVkGX/b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3",
  },
  {
    id: "hpp4J3VqNfWAUOO0d1Us",
    name: "Bella — Professional, Bright, Warm",
    gender: "female",
    characterFit: "Hangat, cerah, ramah",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/hpp4J3VqNfWAUOO0d1Us/dab0f5ba-3aa4-48a8-9fad-f138fea1126d.mp3",
  },
  {
    id: "pFZP5JQG7iQjIQuC4Bku",
    name: "Lily — Velvety Actress",
    gender: "female",
    characterFit: "Bercerita lembut, dramatis",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/pFZP5JQG7iQjIQuC4Bku/89b68b35-b3dd-4348-a84a-a3c13a3c2b30.mp3",
  },
  {
    id: "SAz9YHcvj6GT2YYXdXww",
    name: "River — Relaxed, Neutral, Informative",
    gender: "neutral",
    characterFit: "Netral, tenang, informatif",
    previewUrl:
      "https://storage.googleapis.com/eleven-public-prod/premade/voices/SAz9YHcvj6GT2YYXdXww/e6c95f0b-2227-491a-b3d7-2249240decb7.mp3",
  },
];

export const DEFAULT_FREE_ELEVENLABS_VOICE_ID = "gemini-kid-puck-bold"; // Puck Bold (Obim Default)

/**
 * Creative / Bold / Dynamic Voice Settings for ElevenLabs TTS:
 * - Lower stability (0.25) puts ElevenLabs into maximum "Creative / Expressive" mode so intonation is bold, punchy, and non-monotone.
 * - High similarity_boost (0.85) & style (0.75) with speed (1.12) make young male voices sound brighter, more energetic, and youthful.
 */
export const CREATIVE_DYNAMIC_VOICE_SETTINGS = {
  stability: 0.25,
  similarity_boost: 0.85,
  style: 0.75,
  use_speaker_boost: true,
  speed: 1.12,
} as const;

function pcm16ToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // Byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

export class GeminiChildTTSProvider implements TTSProvider {
  readonly providerKey = "gemini_tts";
  readonly modelName = "gemini-2.5-flash-preview-tts";
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;

  constructor(apiKey: string, defaultVoiceId = "gemini-kid-puck-bold") {
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId;
  }

  async synthesize(input: TTSInput): Promise<TTSResult> {
    const voiceId = input.voiceId || this.defaultVoiceId;
    const cleanText = cleanNarrationForSpeech(input.narrationText);

    const prebuiltName = voiceId.includes("fenrir")
      ? "Fenrir"
      : voiceId.includes("orus")
      ? "Orus"
      : voiceId.includes("charon")
      ? "Charon"
      : voiceId.includes("leda")
      ? "Leda"
      : voiceId.includes("zephyr")
      ? "Zephyr"
      : "Puck";

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Speak in a high-pitched, bold, optimistic, super energetic 10-year-old Indonesian boy adventure hero voice (like a brave young boy cartoon protagonist, confident, bright, loud, and punchy; read only the Indonesian narration below):\n\n${cleanText}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: prebuiltName,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new Error(
          "KUOTA_GEMINI_TTS_HABIS (429): Kuota harian Gemini TTS pada akun ini habis."
        );
      }
      throw new Error(
        `GEMINI_TTS_ERROR (Status ${response.status}): ${errBody.slice(0, 180)}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType?: string;
              data?: string;
            };
          }>;
        };
      }>;
    };

    const b64 =
      data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? "";
    const pcmBuffer = Buffer.from(b64, "base64");
    const wavBuffer = pcm16ToWavBuffer(pcmBuffer, 24000);

    // 24000 Hz * 2 bytes per sample = 48000 bytes per second
    const durationMs = Math.max(
      3000,
      Math.round((pcmBuffer.length / 48000) * 1000)
    );

    const rawSpans = buildEstimatedWordSpans(cleanText);
    const estTotal =
      rawSpans.length > 0 ? rawSpans[rawSpans.length - 1]!.endMs : durationMs;
    const scale = estTotal > 0 ? durationMs / estTotal : 1;
    const wordSpans: WordAlignmentSpan[] = rawSpans.map((sp) => ({
      word: sp.word,
      startMs: Math.round(sp.startMs * scale),
      endMs: Math.max(
        Math.round(sp.startMs * scale) + 20,
        Math.round(sp.endMs * scale)
      ),
    }));

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      voiceId,
      providerRequestId: `gem-tts-${crypto.randomUUID().slice(0, 8)}`,
      audioBuffer: wavBuffer,
      mimeType: "audio/wav",
      durationMs,
      wordSpans,
      timestampStatus: "estimated",
      estimatedCostUsd: 0,
    };
  }
}

export class ElevenLabsTTSProvider implements TTSProvider {
  readonly providerKey = "elevenlabs";
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;

  constructor(
    apiKey: string,
    defaultVoiceId: string,
    modelName = "eleven_flash_v2_5"
  ) {
    this.apiKey = apiKey;
    this.defaultVoiceId = defaultVoiceId || DEFAULT_FREE_ELEVENLABS_VOICE_ID;
    this.modelName = modelName || "eleven_flash_v2_5";
  }

  async synthesize(input: TTSInput): Promise<TTSResult> {
    let voiceId = input.voiceId || this.defaultVoiceId;
    const cleanText = cleanNarrationForSpeech(input.narrationText);

    const callElevenLabs = async (targetVoiceId: string) => {
      const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        targetVoiceId
      )}/with-timestamps`;
      return fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": this.apiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: this.modelName,
          voice_settings: CREATIVE_DYNAMIC_VOICE_SETTINGS,
        }),
      });
    };

    let response = await callElevenLabs(voiceId);

    // If the user is on ElevenLabs Free Tier and picked a Community/Library voice (402 paid_plan_required),
    // automatically fall back to Obim's free premade voice so generation succeeds!
    if (
      response.status === 402 &&
      voiceId !== DEFAULT_FREE_ELEVENLABS_VOICE_ID
    ) {
      voiceId = DEFAULT_FREE_ELEVENLABS_VOICE_ID;
      response = await callElevenLabs(voiceId);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `ELEVENLABS_TTS_ERROR (Status ${response.status}): ${errBody.slice(0, 180)}`
      );
    }

    const data = (await response.json()) as {
      audio_base64?: string;
      alignment?: {
        characters: string[];
        character_start_times_seconds: number[];
        character_end_times_seconds: number[];
      };
    };

    const audioBuffer = Buffer.from(data.audio_base64 ?? "", "base64");
    const hasActualAlignment = Boolean(
      data.alignment &&
        Array.isArray(data.alignment.characters) &&
        data.alignment.characters.length > 0
    );

    const wordSpans = hasActualAlignment
      ? convertCharacterAlignmentToWordSpans(data.alignment!)
      : buildEstimatedWordSpans(cleanText);

    const durationMs =
      wordSpans.length > 0 ? wordSpans[wordSpans.length - 1]!.endMs : 60000;

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      voiceId,
      providerRequestId:
        response.headers.get("request-id") ||
        `xi-${crypto.randomUUID().slice(0, 8)}`,
      audioBuffer,
      mimeType: "audio/mpeg",
      durationMs,
      wordSpans,
      timestampStatus: hasActualAlignment ? "actual" : "estimated",
      estimatedCostUsd: Number(
        ((cleanText.length / 1000) * 0.15).toFixed(4)
      ),
    };
  }
}

export function getActiveTTSProvider(overrideProfileId?: string): TTSProvider {
  const apiKey = (process.env.ELEVENLABS_API_KEY || "").trim();
  const voiceId = (
    process.env.ELEVENLABS_VOICE_ID || DEFAULT_FREE_ELEVENLABS_VOICE_ID
  ).trim();

  if (apiKey) {
    return new ElevenLabsTTSProvider(apiKey, voiceId);
  }

  return new MockTTSProvider();
}
