import fs from "fs";
import path from "path";
import crypto from "crypto";

export type ElevenLabsModelId =
  | "eleven_flash_v2_5"
  | "eleven_turbo_v2_5"
  | "eleven_multilingual_v2";

export interface ProviderProfile {
  id: string;
  label: string; // e.g., "Akun 1 - Utama"
  googleEmail?: string; // e.g., "obim1@gmail.com"
  geminiApiKey: string;
  elevenlabsApiKey: string;
  elevenlabsVoiceId: string;
  elevenlabsModelId: ElevenLabsModelId;
  gflowApiKey: string;
  localUsedCredits?: number;
  localCreditLimit?: number;
  geminiTtsUsedToday?: number;
  geminiTtsLimitPerDay?: number;
  geminiTtsDateKey?: string; // YYYY-MM-DD (Pacific time / daily reset key)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfilesVault {
  activeProfileId: string;
  profiles: ProviderProfile[];
}

export interface MaskedProviderProfile {
  id: string;
  label: string;
  googleEmail?: string;
  hasGeminiKey: boolean;
  geminiKeyPreview: string;
  hasElevenlabsKey: boolean;
  elevenlabsKeyPreview: string;
  elevenlabsVoiceId: string;
  elevenlabsModelId: ElevenLabsModelId;
  hasGflowKey: boolean;
  gflowKeyPreview: string;
  localUsedCredits: number;
  localCreditLimit: number;
  geminiTtsUsedToday: number;
  geminiTtsLimitPerDay: number;
  geminiTtsRemainingToday: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElevenLabsQuotaInfo {
  profileId: string;
  label: string;
  status: "ok" | "local_tracked" | "missing_key" | "error";
  tier?: string;
  characterCount: number;
  characterLimit: number;
  remainingCharacters: number;
  resetUnix?: number | null;
  missingUserReadPermission?: boolean;
  elevenlabsTtsReady?: boolean;
  elevenlabsStatusText?: string;
  geminiStatus?: "ok" | "missing_key" | "quota_exceeded" | "error";
  geminiStatusText?: string;
  geminiLatencyMs?: number;
  geminiTtsUsedToday?: number;
  geminiTtsLimitPerDay?: number;
  geminiTtsRemainingToday?: number;
  checkedAtIso?: string;
  errorMessage?: string;
}

const VAULT_FILE_PATH = path.join(
  process.cwd(),
  "storage",
  "provider-profiles.local.json"
);

function maskSecret(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "Belum Diisi";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 3)}***`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function buildDefaultVaultFromEnv(): ProviderProfilesVault {
  const now = new Date().toISOString();
  const defaultProfile: ProviderProfile = {
    id: "profile-1-default",
    label: "Akun 1 - Utama (Default .env)",
    googleEmail: "",
    geminiApiKey: (
      process.env.GEMINI_API_KEY ||
      process.env.LLM_API_KEY ||
      ""
    ).trim(),
    elevenlabsApiKey: (process.env.ELEVENLABS_API_KEY || "").trim(),
    elevenlabsVoiceId: (
      process.env.ELEVENLABS_VOICE_ID || "SOYHLrjzK2X1ezoPC6cr"
    ).trim(),
    elevenlabsModelId: "eleven_flash_v2_5",
    gflowApiKey: (process.env.VIDEO_PROVIDER_API_KEY || "").trim(),
    notes: "Profil bawaan yang disinkronkan dari .env.local",
    createdAt: now,
    updatedAt: now,
  };

  return {
    activeProfileId: defaultProfile.id,
    profiles: [defaultProfile],
  };
}

export function readProviderProfilesVault(): ProviderProfilesVault {
  try {
    if (!fs.existsSync(VAULT_FILE_PATH)) {
      const initial = buildDefaultVaultFromEnv();
      writeProviderProfilesVault(initial);
      return initial;
    }

    const raw = fs.readFileSync(VAULT_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProviderProfilesVault>;
    if (!parsed || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      const initial = buildDefaultVaultFromEnv();
      writeProviderProfilesVault(initial);
      return initial;
    }

    // Backfill default profile if env keys were added later and profile-1 is empty
    const profiles = parsed.profiles.map((p, index) => {
      if (index === 0) {
        return {
          ...p,
          geminiApiKey:
            p.geminiApiKey ||
            (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "").trim(),
          elevenlabsApiKey:
            p.elevenlabsApiKey || (process.env.ELEVENLABS_API_KEY || "").trim(),
          elevenlabsVoiceId:
            p.elevenlabsVoiceId ||
            (process.env.ELEVENLABS_VOICE_ID || "SOYHLrjzK2X1ezoPC6cr").trim(),
          elevenlabsModelId: p.elevenlabsModelId || "eleven_flash_v2_5",
          gflowApiKey:
            p.gflowApiKey || (process.env.VIDEO_PROVIDER_API_KEY || "").trim(),
        };
      }
      return {
        ...p,
        elevenlabsVoiceId: p.elevenlabsVoiceId || "SOYHLrjzK2X1ezoPC6cr",
        elevenlabsModelId: p.elevenlabsModelId || "eleven_flash_v2_5",
      };
    });

    const activeId =
      profiles.find((p) => p.id === parsed.activeProfileId)?.id ??
      profiles[0]!.id;

    return {
      activeProfileId: activeId,
      profiles,
    };
  } catch {
    return buildDefaultVaultFromEnv();
  }
}

export function writeProviderProfilesVault(vault: ProviderProfilesVault): void {
  const dir = path.dirname(VAULT_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(vault, null, 2), "utf8");
}

export function getActiveProviderProfile(overrideProfileId?: string): ProviderProfile {
  const vault = readProviderProfilesVault();
  if (overrideProfileId) {
    const found = vault.profiles.find((p) => p.id === overrideProfileId);
    if (found) return found;
  }
  return (
    vault.profiles.find((p) => p.id === vault.activeProfileId) ??
    vault.profiles[0]!
  );
}

export function getActiveTTSProviderFromVault(
  overrideProfileId?: string,
  targetVoiceId?: string
) {
  const {
    ElevenLabsTTSProvider,
    GeminiChildTTSProvider,
    MockTTSProvider,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } = require("@/lib/providers/tts/tts-provider") as typeof import("@/lib/providers/tts/tts-provider");

  const profile = getActiveProviderProfile(overrideProfileId);
  const resolvedVoiceId = (
    targetVoiceId ||
    profile.elevenlabsVoiceId ||
    process.env.ELEVENLABS_VOICE_ID ||
    "cgSgspJ2msm6clMCkdW9"
  ).trim();

  if (resolvedVoiceId.startsWith("gemini-kid-")) {
    const geminiKey = (
      profile.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.LLM_API_KEY ||
      ""
    ).trim();
    if (geminiKey) {
      return new GeminiChildTTSProvider(geminiKey, resolvedVoiceId);
    }
  }

  const apiKey = (
    profile.elevenlabsApiKey ||
    process.env.ELEVENLABS_API_KEY ||
    ""
  ).trim();
  const modelId = profile.elevenlabsModelId || "eleven_flash_v2_5";

  if (apiKey) {
    return new ElevenLabsTTSProvider(apiKey, resolvedVoiceId, modelId);
  }
  return new MockTTSProvider();
}

export function setActiveProviderProfile(profileId: string): ProviderProfilesVault {
  const vault = readProviderProfilesVault();
  const exists = vault.profiles.some((p) => p.id === profileId);
  if (!exists) {
    throw new Error("Profil akun tidak ditemukan.");
  }
  vault.activeProfileId = profileId;
  writeProviderProfilesVault(vault);
  return vault;
}

export function rotateToNextProviderProfile(): ProviderProfile {
  const vault = readProviderProfilesVault();
  if (vault.profiles.length === 0) {
    throw new Error("Tidak ada profil akun tersimpan.");
  }
  const currentIndex = vault.profiles.findIndex(
    (p) => p.id === vault.activeProfileId
  );
  const nextIndex = (currentIndex + 1) % vault.profiles.length;
  const nextProfile = vault.profiles[nextIndex] ?? vault.profiles[0]!;
  vault.activeProfileId = nextProfile.id;
  writeProviderProfilesVault(vault);
  return nextProfile;
}

export function rotateToNextGeminiProfile(): ProviderProfile | null {
  const vault = readProviderProfilesVault();
  if (vault.profiles.length === 0) return null;
  const currentIndex = vault.profiles.findIndex(
    (p) => p.id === vault.activeProfileId
  );
  for (let i = 1; i <= vault.profiles.length; i++) {
    const idx = (currentIndex + i) % vault.profiles.length;
    const candidate = vault.profiles[idx];
    if (candidate?.geminiApiKey && candidate.geminiApiKey.trim()) {
      vault.activeProfileId = candidate.id;
      writeProviderProfilesVault(vault);
      return candidate;
    }
  }
  return null;
}

export function upsertProviderProfile(input: {
  id?: string;
  label: string;
  googleEmail?: string;
  geminiApiKey?: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsModelId?: ElevenLabsModelId;
  gflowApiKey?: string;
  localUsedCredits?: number;
  localCreditLimit?: number;
  notes?: string;
  setAsActive?: boolean;
}): ProviderProfilesVault {
  const vault = readProviderProfilesVault();
  const now = new Date().toISOString();

  const existingIndex = input.id
    ? vault.profiles.findIndex((p) => p.id === input.id)
    : -1;

  if (existingIndex >= 0) {
    const prev = vault.profiles[existingIndex]!;
    const updated: ProviderProfile = {
      ...prev,
      label: input.label.trim() || prev.label,
      googleEmail:
        input.googleEmail !== undefined
          ? input.googleEmail.trim()
          : prev.googleEmail,
      geminiApiKey:
        input.geminiApiKey !== undefined && input.geminiApiKey.trim() !== ""
          ? input.geminiApiKey.trim()
          : prev.geminiApiKey,
      elevenlabsApiKey:
        input.elevenlabsApiKey !== undefined &&
        input.elevenlabsApiKey.trim() !== ""
          ? input.elevenlabsApiKey.trim()
          : prev.elevenlabsApiKey,
      elevenlabsVoiceId:
        input.elevenlabsVoiceId !== undefined &&
        input.elevenlabsVoiceId.trim() !== ""
          ? input.elevenlabsVoiceId.trim()
          : prev.elevenlabsVoiceId,
      elevenlabsModelId: input.elevenlabsModelId || prev.elevenlabsModelId,
      gflowApiKey:
        input.gflowApiKey !== undefined && input.gflowApiKey.trim() !== ""
          ? input.gflowApiKey.trim()
          : prev.gflowApiKey,
      localUsedCredits:
        typeof input.localUsedCredits === "number"
          ? Math.max(0, input.localUsedCredits)
          : prev.localUsedCredits ?? 0,
      localCreditLimit:
        typeof input.localCreditLimit === "number" && input.localCreditLimit > 0
          ? input.localCreditLimit
          : prev.localCreditLimit ?? 10000,
      notes: input.notes !== undefined ? input.notes.trim() : prev.notes,
      updatedAt: now,
    };
    vault.profiles[existingIndex] = updated;
    if (input.setAsActive) {
      vault.activeProfileId = updated.id;
    }
  } else {
    const newId = `profile-${vault.profiles.length + 1}-${crypto
      .randomUUID()
      .slice(0, 6)}`;
    const created: ProviderProfile = {
      id: newId,
      label:
        input.label.trim() || `Akun ${vault.profiles.length + 1}`,
      googleEmail: (input.googleEmail || "").trim(),
      geminiApiKey: (input.geminiApiKey || "").trim(),
      elevenlabsApiKey: (input.elevenlabsApiKey || "").trim(),
      elevenlabsVoiceId:
        (input.elevenlabsVoiceId || "").trim() ||
        process.env.ELEVENLABS_VOICE_ID ||
        "SOYHLrjzK2X1ezoPC6cr",
      elevenlabsModelId: input.elevenlabsModelId || "eleven_flash_v2_5",
      gflowApiKey: (input.gflowApiKey || "").trim(),
      localUsedCredits:
        typeof input.localUsedCredits === "number"
          ? Math.max(0, input.localUsedCredits)
          : 0,
      localCreditLimit:
        typeof input.localCreditLimit === "number" && input.localCreditLimit > 0
          ? input.localCreditLimit
          : 10000,
      notes: (input.notes || "").trim(),
      createdAt: now,
      updatedAt: now,
    };
    vault.profiles.push(created);
    if (input.setAsActive !== false) {
      vault.activeProfileId = created.id;
    }
  }

  writeProviderProfilesVault(vault);
  return vault;
}

export function getTodayPacificDateKey(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function getNormalizedGeminiTtsUsage(p: ProviderProfile): {
  usedToday: number;
  limitPerDay: number;
  remainingToday: number;
  dateKey: string;
} {
  const todayKey = getTodayPacificDateKey();
  const limitPerDay = p.geminiTtsLimitPerDay ?? 10;
  const usedToday =
    p.geminiTtsDateKey === todayKey
      ? Math.min(limitPerDay, Math.max(0, p.geminiTtsUsedToday ?? 0))
      : 0;
  const remainingToday = Math.max(0, limitPerDay - usedToday);
  return { usedToday, limitPerDay, remainingToday, dateKey: todayKey };
}

export function recordGeminiTtsUsageForActiveProfile(options?: {
  markExhausted429?: boolean;
  profileId?: string;
}): void {
  try {
    const vault = readProviderProfilesVault();
    const targetId = options?.profileId || vault.activeProfileId;
    const idx = vault.profiles.findIndex((p) => p.id === targetId);
    if (idx < 0) return;
    const p = vault.profiles[idx]!;
    const norm = getNormalizedGeminiTtsUsage(p);
    const nextUsed = options?.markExhausted429
      ? norm.limitPerDay
      : Math.min(norm.limitPerDay, norm.usedToday + 1);

    vault.profiles[idx] = {
      ...p,
      geminiTtsUsedToday: nextUsed,
      geminiTtsLimitPerDay: norm.limitPerDay,
      geminiTtsDateKey: norm.dateKey,
      updatedAt: new Date().toISOString(),
    };
    writeProviderProfilesVault(vault);
  } catch {
    // ignore tracking write errors
  }
}

export function recordUsedCreditsForActiveProfile(charLength: number): void {
  try {
    const vault = readProviderProfilesVault();
    const idx = vault.profiles.findIndex(
      (p) => p.id === vault.activeProfileId
    );
    if (idx < 0) return;
    const p = vault.profiles[idx]!;
    const isHalfCredit =
      (p.elevenlabsModelId || "eleven_flash_v2_5") !== "eleven_multilingual_v2";
    const creditCost = isHalfCredit
      ? Math.ceil(charLength * 0.5)
      : charLength;
    vault.profiles[idx] = {
      ...p,
      localUsedCredits: (p.localUsedCredits ?? 0) + creditCost,
      updatedAt: new Date().toISOString(),
    };
    writeProviderProfilesVault(vault);
  } catch {
    // ignore tracking write errors
  }
}

export function deleteProviderProfile(profileId: string): ProviderProfilesVault {
  const vault = readProviderProfilesVault();
  if (vault.profiles.length <= 1) {
    throw new Error("Minimal harus ada 1 profil akun yang tersimpan.");
  }
  vault.profiles = vault.profiles.filter((p) => p.id !== profileId);
  if (vault.activeProfileId === profileId) {
    vault.activeProfileId = vault.profiles[0]!.id;
  }
  writeProviderProfilesVault(vault);
  return vault;
}

export function toMaskedProfile(p: ProviderProfile): MaskedProviderProfile {
  const ttsUsage = getNormalizedGeminiTtsUsage(p);
  return {
    id: p.id,
    label: p.label,
    googleEmail: p.googleEmail,
    hasGeminiKey: Boolean(p.geminiApiKey.trim()),
    geminiKeyPreview: maskSecret(p.geminiApiKey),
    hasElevenlabsKey: Boolean(p.elevenlabsApiKey.trim()),
    elevenlabsKeyPreview: maskSecret(p.elevenlabsApiKey),
    elevenlabsVoiceId: p.elevenlabsVoiceId || "SOYHLrjzK2X1ezoPC6cr",
    elevenlabsModelId: p.elevenlabsModelId || "eleven_flash_v2_5",
    hasGflowKey: Boolean(p.gflowApiKey.trim()),
    gflowKeyPreview: maskSecret(p.gflowApiKey),
    localUsedCredits: p.localUsedCredits ?? 0,
    localCreditLimit: p.localCreditLimit ?? 10000,
    geminiTtsUsedToday: ttsUsage.usedToday,
    geminiTtsLimitPerDay: ttsUsage.limitPerDay,
    geminiTtsRemainingToday: p.geminiApiKey.trim()
      ? ttsUsage.remainingToday
      : 0,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function checkGeminiRealtimeStatus(
  profile: ProviderProfile
): Promise<{
  geminiStatus: "ok" | "missing_key" | "quota_exceeded" | "error";
  geminiStatusText: string;
  geminiLatencyMs?: number;
  geminiTtsUsedToday: number;
  geminiTtsLimitPerDay: number;
  geminiTtsRemainingToday: number;
}> {
  const key = (profile.geminiApiKey || "").trim();
  const ttsUsage = getNormalizedGeminiTtsUsage(profile);

  if (!key) {
    return {
      geminiStatus: "missing_key",
      geminiStatusText: "API Key Gemini belum diisi",
      geminiTtsUsedToday: 0,
      geminiTtsLimitPerDay: ttsUsage.limitPerDay,
      geminiTtsRemainingToday: 0,
    };
  }

  const startMs = Date.now();
  try {
    // 1) Ping Gemini 3 Flash Text AND 2) Non-audio text ping to gemini-2.5-flash-preview-tts (returns 429 if TTS daily quota is exhausted, or 400 if quota is still available without consuming an audio generation!)
    const [textRes, ttsProbeRes] = await Promise.all([
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(
          key
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "ok" }] }],
            generationConfig: { maxOutputTokens: 1 },
          }),
          cache: "no-store",
        }
      ),
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(
          key
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Halo" }] }],
            generationConfig: { responseModalities: ["AUDIO"] },
          }),
          cache: "no-store",
        }
      ),
    ]);

    const latencyMs = Date.now() - startMs;

    if (ttsProbeRes.status === 429) {
      recordGeminiTtsUsageForActiveProfile({
        markExhausted429: true,
        profileId: profile.id,
      });
      return {
        geminiStatus: "quota_exceeded",
        geminiStatusText: `Kuota Gemini TTS Habis Hari Ini (0 / ${ttsUsage.limitPerDay} Audio) • Text Masih Aktif (1.500/hari)`,
        geminiLatencyMs: latencyMs,
        geminiTtsUsedToday: ttsUsage.limitPerDay,
        geminiTtsLimitPerDay: ttsUsage.limitPerDay,
        geminiTtsRemainingToday: 0,
      };
    }

    if (textRes.ok) {
      const tier = textRes.headers.get("x-gemini-service-tier") || "standard";
      const isExhausted = ttsUsage.remainingToday <= 0;
      return {
        geminiStatus: isExhausted ? "quota_exceeded" : "ok",
        geminiStatusText: isExhausted
          ? `Kuota Gemini TTS Habis Hari Ini (0 / ${ttsUsage.limitPerDay} Audio) • Text Aktif`
          : `Aktif • Sisa Gemini TTS: ${ttsUsage.remainingToday} / ${ttsUsage.limitPerDay} Audio Hari Ini • Text: 1.500/hari (${tier}, ${latencyMs}ms)`,
        geminiLatencyMs: latencyMs,
        geminiTtsUsedToday: ttsUsage.usedToday,
        geminiTtsLimitPerDay: ttsUsage.limitPerDay,
        geminiTtsRemainingToday: ttsUsage.remainingToday,
      };
    }

    if (textRes.status === 429) {
      return {
        geminiStatus: "quota_exceeded",
        geminiStatusText:
          "Limit RPM/RPD Tercapai (429 Resource Exhausted — Klik 'Pakai' pada Akun Lain)",
        geminiLatencyMs: latencyMs,
        geminiTtsUsedToday: ttsUsage.usedToday,
        geminiTtsLimitPerDay: ttsUsage.limitPerDay,
        geminiTtsRemainingToday: ttsUsage.remainingToday,
      };
    }

    const errText = await textRes.text().catch(() => "");
    return {
      geminiStatus: "error",
      geminiStatusText: `Key Error (HTTP ${textRes.status}): ${errText.slice(0, 60)}`,
      geminiLatencyMs: latencyMs,
      geminiTtsUsedToday: ttsUsage.usedToday,
      geminiTtsLimitPerDay: ttsUsage.limitPerDay,
      geminiTtsRemainingToday: ttsUsage.remainingToday,
    };
  } catch (err) {
    return {
      geminiStatus: "error",
      geminiStatusText:
        err instanceof Error ? err.message : "Gagal tes koneksi Gemini",
      geminiTtsUsedToday: ttsUsage.usedToday,
      geminiTtsLimitPerDay: ttsUsage.limitPerDay,
      geminiTtsRemainingToday: ttsUsage.remainingToday,
    };
  }
}

export async function fetchElevenLabsQuotaForProfile(
  profile: ProviderProfile,
  options?: { checkGeminiLive?: boolean }
): Promise<ElevenLabsQuotaInfo> {
  const key = (profile.elevenlabsApiKey || "").trim();
  const localLimit = profile.localCreditLimit ?? 10000;
  const localUsed = profile.localUsedCredits ?? 0;
  const localRemaining = Math.max(0, localLimit - localUsed);
  const nowIso = new Date().toISOString();
  const ttsUsage = getNormalizedGeminiTtsUsage(profile);

  // Check Gemini status in parallel if requested (or quick key check by default)
  const geminiPromise = options?.checkGeminiLive
    ? checkGeminiRealtimeStatus(profile)
    : Promise.resolve(
        profile.geminiApiKey.trim()
          ? {
              geminiStatus:
                ttsUsage.remainingToday <= 0
                  ? ("quota_exceeded" as const)
                  : ("ok" as const),
              geminiStatusText:
                ttsUsage.remainingToday <= 0
                  ? `Kuota Gemini TTS Habis Hari Ini (0 / ${ttsUsage.limitPerDay} Audio — Reset Besok)`
                  : `Sisa Gemini TTS: ${ttsUsage.remainingToday} / ${ttsUsage.limitPerDay} Audio Hari Ini • Text: 1.500 Req/Hari`,
              geminiTtsUsedToday: ttsUsage.usedToday,
              geminiTtsLimitPerDay: ttsUsage.limitPerDay,
              geminiTtsRemainingToday: ttsUsage.remainingToday,
            }
          : {
              geminiStatus: "missing_key" as const,
              geminiStatusText: "API Key Gemini belum diisi",
              geminiTtsUsedToday: 0,
              geminiTtsLimitPerDay: ttsUsage.limitPerDay,
              geminiTtsRemainingToday: 0,
            }
      );

  if (!key) {
    const gem = await geminiPromise;
    return {
      profileId: profile.id,
      label: profile.label,
      status: "missing_key",
      characterCount: 0,
      characterLimit: localLimit,
      remainingCharacters: 0,
      elevenlabsTtsReady: false,
      elevenlabsStatusText: "API Key ElevenLabs belum diisi",
      ...gem,
      checkedAtIso: nowIso,
      errorMessage: "API Key ElevenLabs belum diisi untuk akun ini.",
    };
  }

  try {
    const [subRes, voicesRes, gem] = await Promise.all([
      fetch("https://api.elevenlabs.io/v1/user/subscription", {
        method: "GET",
        headers: { "xi-api-key": key },
        cache: "no-store",
      }),
      fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: { "xi-api-key": key },
        cache: "no-store",
      }),
      geminiPromise,
    ]);

    const ttsReady = voicesRes.ok;

    if (!subRes.ok) {
      const errText = await subRes.text().catch(() => "");
      const isMissingUserRead =
        errText.includes("user_read") || errText.includes("missing_permissions");

      if (isMissingUserRead) {
        return {
          profileId: profile.id,
          label: profile.label,
          status: ttsReady ? "local_tracked" : "error",
          tier: "free",
          characterCount: localUsed,
          characterLimit: localLimit,
          remainingCharacters: localRemaining,
          missingUserReadPermission: true,
          elevenlabsTtsReady: ttsReady,
          elevenlabsStatusText: ttsReady
            ? "TTS Aktif (200 OK) • Izin 'User Read' belum dicentang di ElevenLabs"
            : `Key ElevenLabs Tidak Valid (HTTP ${voicesRes.status})`,
          ...gem,
          checkedAtIso: nowIso,
        };
      }

      return {
        profileId: profile.id,
        label: profile.label,
        status: "error",
        tier: "free",
        characterCount: localUsed,
        characterLimit: localLimit,
        remainingCharacters: localRemaining,
        elevenlabsTtsReady: ttsReady,
        elevenlabsStatusText: `Key Error (HTTP ${subRes.status})`,
        ...gem,
        checkedAtIso: nowIso,
        errorMessage: `HTTP ${subRes.status}`,
      };
    }

    const data = (await subRes.json()) as {
      tier?: string;
      character_count?: number;
      character_limit?: number;
      next_character_count_reset_unix?: number | null;
    };

    const used = Number(data.character_count ?? localUsed);
    const limit = Number(data.character_limit ?? localLimit);
    const rem = Math.max(0, limit - used);

    return {
      profileId: profile.id,
      label: profile.label,
      status: "ok",
      tier: data.tier || "free",
      characterCount: used,
      characterLimit: limit,
      remainingCharacters: rem,
      resetUnix: data.next_character_count_reset_unix ?? null,
      elevenlabsTtsReady: true,
      elevenlabsStatusText: `Real-Time Server ElevenLabs (${
        data.tier || "free"
      }): Sisa ${rem.toLocaleString("id-ID")} / ${limit.toLocaleString(
        "id-ID"
      )} kredit`,
      ...gem,
      checkedAtIso: nowIso,
    };
  } catch (err) {
    const gem = await geminiPromise;
    return {
      profileId: profile.id,
      label: profile.label,
      status: "local_tracked",
      characterCount: localUsed,
      characterLimit: localLimit,
      remainingCharacters: localRemaining,
      elevenlabsTtsReady: false,
      elevenlabsStatusText:
        err instanceof Error ? err.message : "Gagal menghubungi ElevenLabs",
      ...gem,
      checkedAtIso: nowIso,
    };
  }
}
