import { z } from "zod";
import type { ProjectSettingsSummary, ProviderStatusSummary } from "@/types/domain";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("CeritaObim Studio"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
});

export function getPublicEnv() {
  return PublicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || "CeritaObim Studio",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  });
}

export const DEFAULT_OWNER_ID = "00000000-0000-0000-0000-000000000001";

export const DEFAULT_PROJECT_SETTINGS: ProjectSettingsSummary = {
  ownerId: DEFAULT_OWNER_ID,
  projectName: "CeritaObim Studio",
  channelName: "cerita_obim",
  language: "id-ID",
  timezone: "Asia/Makassar",
  niche:
    "Tiga Program Resmi Si Obim: Ke Dapur Yuk! (Kuliner & Makanan), Kepikiran Aja (Psikologi & Pertanyaan Sebelum Tidur), dan Eh, Ternyata! (Fakta Sains & Mitos)",
  toneGuide:
    "Hangat, penasaran, jelas, padat, bercerita cepat tanpa bertele-tele (durasi 15-30 detik), bahasa Indonesia kasual-edukatif.",
  visualStyleGuide:
    "Handmade origami paper stop-motion; setiap karakter, objek, properti, dan latar belakang tampak terbuat dari kertas lipat; tanpa manusia/objek fotorealistik; tanpa subtitle atau teks di dalam video.",
  characterDescription:
    "Obim: karakter anak muda ramah dari lipatan kertas origami warna krem hangat, kemeja flanel kotak-kotak merah, dan rambut mangkuk biru-hitam, proporsi konsisten di setiap scene.",
  characterReferenceAssetIds: [],
  defaultDurationSeconds: 28,
  targetSceneSecondsMin: 6,
  targetSceneSecondsMax: 10,
  outputAspectRatio: "9:16",
  outputWidth: 1080,
  outputHeight: 1920,
  noSubtitles: true,
  weeklyVideoTarget: 21,
  dailyBudgetLimit: 10,
  monthlyBudgetLimit: 50,
  maxSceneRetries: 2,
  videoGenerationMode: "semi_manual_flow",
  targetPlatforms: ["tiktok", "youtube", "instagram"],
};

/**
 * Server-side helper to inspect whether environment variables are present
 * without ever exposing secret values to the client.
 * Never claims an unverified integration is connected.
 */
export function getServerProviderStatuses(
  env: Record<string, string | undefined> = process.env
): ProviderStatusSummary[] {
  const hasSupabase = Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const hasLlm = Boolean(env.LLM_PROVIDER && env.LLM_API_KEY);
  const hasElevenLabs = Boolean(env.ELEVENLABS_API_KEY);
  const hasWorker = Boolean(env.FFMPEG_WORKER_URL || env.JOB_RUNNER_SECRET);
  const hasVideoApi = Boolean(env.VIDEO_PROVIDER && env.VIDEO_API_KEY);

  return [
    {
      key: "supabase",
      displayName: "Supabase (Database, Auth & Storage)",
      category: "database",
      modeLabel: hasSupabase
        ? "Dikonfigurasi di Env (Siap Uji Koneksi)"
        : "Mode Fallback File Lokal (.data/)",
      connected: false,
      configuredInEnv: hasSupabase,
      notes:
        "Menyimpan Project Settings dan Content Library di PostgreSQL (dengan fallback file lokal bila tabel belum dimigrasikan).",
    },
    {
      key: "llm",
      displayName: "LLM Content Planner & Script Writer",
      category: "llm",
      modeLabel: hasLlm
        ? `Env Terdeteksi (${env.LLM_PROVIDER})`
        : "Belum Dikonfigurasi (Mode Mock/Manual)",
      connected: false,
      configuredInEnv: hasLlm,
      notes:
        "Adapter LLM dengan validasi skema terstruktur akan diimplementasikan pada Milestone 2.",
    },
    {
      key: "elevenlabs",
      displayName: "ElevenLabs TTS & Timestamp Alignment",
      category: "tts",
      modeLabel: hasElevenLabs
        ? "API Key Terdeteksi (Belum Diuji)"
        : "Mode Fallback Upload MP3 Manual",
      connected: false,
      configuredInEnv: hasElevenLabs,
      notes:
        "Mendukung adapter TTS atau upload MP3 manual beserta validasi timestamp pada Milestone 3.",
    },
    {
      key: "google_flow",
      displayName: "Google Flow (Produksi Klip Video)",
      category: "video",
      modeLabel: hasVideoApi
        ? `API Video Opsional (${env.VIDEO_PROVIDER})`
        : "Mode Semi-Manual (Prompt Pack & Upload Klip)",
      connected: false,
      configuredInEnv: hasVideoApi,
      notes:
        "MVP menggunakan alur semi-manual Google Flow (ekspor paket prompt & unggah klip). Tidak mengklaim API Google Flow atau rotasi akun otomatis.",
    },
    {
      key: "ffmpeg_worker",
      displayName: "Durable Background Queue & FFmpeg Worker",
      category: "worker",
      modeLabel: hasWorker ? "Env Worker Terdeteksi" : "Belum Dikonfigurasi",
      connected: false,
      configuredInEnv: hasWorker,
      notes:
        "Perakitan video 9:16 (1080x1920) dan antrean job tahan lama akan dibangun pada Milestone 5.",
    },
    {
      key: "social_publishing",
      displayName: "Publikasi TikTok, YouTube Shorts, Instagram Reels",
      category: "publishing",
      modeLabel: "Paket Ekspor & Checklist Manual (MVP)",
      connected: false,
      configuredInEnv: false,
      notes:
        "Publikasi MVP bersifat manual. Aplikasi menyiapkan master MP4, variasi caption/hashtag, dan checklist.",
    },
  ];
}
