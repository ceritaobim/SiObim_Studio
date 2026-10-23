import type {
  BudgetLedgerRecord,
  ProjectSettingsSummary,
  VideoGenerationMode,
} from "@/types/domain";

export interface BatchCostScenarioEstimate {
  videoCount: number;
  mode: VideoGenerationMode;
  bestCaseUsd: number;
  expectedCaseUsd: number;
  worstCaseUsd: number;
  costCertainty: "known_estimate" | "unknown_external_quota";
  breakdown: {
    llmPlanningUsd: number;
    ttsVoiceUsd: number;
    videoClipsUsd: number;
    ffmpegAssemblyUsd: number;
  };
  notes: string;
}

export interface BudgetGuardEvaluation {
  allowed: boolean;
  spentTodayUsd: number;
  spentThisMonthUsd: number;
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  requestedAmountUsd: number;
  reason: string | null;
}

/**
 * Calculates best, expected, and worst-case cost estimates for a batch of videos
 * based on retry policy and selected provider mode.
 */
export function calculateBatchCostEstimate(params: {
  videoCount: number;
  narrationCharacterCountPerVideo?: number;
  scenesPerVideo?: number;
  maxSceneRetries?: number;
  videoMode?: VideoGenerationMode;
  llmIsPaidApi?: boolean;
  ttsIsPaidApi?: boolean;
  videoClipUnitCostUsd?: number | null;
}): BatchCostScenarioEstimate {
  const videoCount = Math.max(1, params.videoCount);
  const chars = params.narrationCharacterCountPerVideo ?? 950;
  const scenesPerVideo = params.scenesPerVideo ?? 9;
  const maxRetries = params.maxSceneRetries ?? 2;
  const mode = params.videoMode ?? "semi_manual_flow";

  const llmUnit = params.llmIsPaidApi ? 0.002 : 0;
  const ttsUnit = params.ttsIsPaidApi ? (chars / 1000) * 0.15 : 0;
  const videoClipUnit =
    mode === "api_provider" ? (params.videoClipUnitCostUsd ?? 0.25) : 0;

  const llmPlanningUsd = Number((videoCount * llmUnit).toFixed(4));
  const ttsVoiceUsd = Number((videoCount * ttsUnit).toFixed(4));
  const videoClipsUsd = Number(
    (videoCount * scenesPerVideo * videoClipUnit).toFixed(4)
  );
  const ffmpegAssemblyUsd = 0; // Self-hosted / worker CPU execution

  const bestCaseUsd = Number(
    (llmPlanningUsd + ttsVoiceUsd + videoClipsUsd + ffmpegAssemblyUsd).toFixed(4)
  );

  // Expected assumes ~15% retry overhead on paid generation steps
  const expectedCaseUsd = Number((bestCaseUsd * 1.15).toFixed(4));

  // Worst case assumes maxSceneRetries triggered on paid steps
  const worstMultiplier = 1 + maxRetries * 0.5;
  const worstCaseUsd = Number((bestCaseUsd * worstMultiplier).toFixed(4));

  const costCertainty =
    mode === "api_provider" && params.videoClipUnitCostUsd === null
      ? "unknown_external_quota"
      : "known_estimate";

  return {
    videoCount,
    mode,
    bestCaseUsd,
    expectedCaseUsd,
    worstCaseUsd,
    costCertainty,
    breakdown: {
      llmPlanningUsd,
      ttsVoiceUsd,
      videoClipsUsd,
      ffmpegAssemblyUsd,
    },
    notes:
      mode === "semi_manual_flow"
        ? "Mode Semi-Manual Google Flow tidak mengenakan biaya API video di dalam aplikasi (menggunakan kuota akun Google Flow Anda secara manual)."
        : costCertainty === "unknown_external_quota"
        ? "Biaya API video belum diketahui (UNKNOWN) — memerlukan konfirmasi manual."
        : "Estimasi mencakup perencanaan LLM, sintesis suara TTS, dan pembuatan klip.",
  };
}

/**
 * Evaluates whether a new paid job is within the owner's configured daily and monthly spending caps.
 */
export function evaluateBudgetGuard(params: {
  settings: Pick<
    ProjectSettingsSummary,
    "dailyBudgetLimit" | "monthlyBudgetLimit"
  >;
  ledgerEntries: BudgetLedgerRecord[];
  requestedAmountUsd: number;
  now?: Date;
}): BudgetGuardEvaluation {
  const now = params.now ?? new Date();
  const todayPrefix = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const monthPrefix = now.toISOString().slice(0, 7); // YYYY-MM

  let spentTodayUsd = 0;
  let spentThisMonthUsd = 0;

  for (const entry of params.ledgerEntries) {
    if (entry.unit !== "USD") continue;
    const sign =
      entry.eventType === "charge" || entry.eventType === "reservation"
        ? 1
        : entry.eventType === "refund"
        ? -1
        : 0;
    if (sign === 0) continue;

    const delta = entry.amount * sign;
    if (entry.occurredAt.startsWith(monthPrefix)) {
      spentThisMonthUsd += delta;
    }
    if (entry.occurredAt.startsWith(todayPrefix)) {
      spentTodayUsd += delta;
    }
  }

  spentTodayUsd = Math.max(0, Number(spentTodayUsd.toFixed(4)));
  spentThisMonthUsd = Math.max(0, Number(spentThisMonthUsd.toFixed(4)));

  const dailyLimitUsd = params.settings.dailyBudgetLimit;
  const monthlyLimitUsd = params.settings.monthlyBudgetLimit;
  const requested = Math.max(0, params.requestedAmountUsd);

  if (requested > 0 && spentTodayUsd + requested > dailyLimitUsd) {
    return {
      allowed: false,
      spentTodayUsd,
      spentThisMonthUsd,
      dailyLimitUsd,
      monthlyLimitUsd,
      requestedAmountUsd: requested,
      reason: `BUDGET_EXCEEDED_DAILY: Permintaan ($${requested}) melampaui batas anggaran harian ($${spentTodayUsd} / $${dailyLimitUsd}). Job dijeda secara otomatis.`,
    };
  }

  if (requested > 0 && spentThisMonthUsd + requested > monthlyLimitUsd) {
    return {
      allowed: false,
      spentTodayUsd,
      spentThisMonthUsd,
      dailyLimitUsd,
      monthlyLimitUsd,
      requestedAmountUsd: requested,
      reason: `BUDGET_EXCEEDED_MONTHLY: Permintaan ($${requested}) melampaui batas anggaran bulanan ($${spentThisMonthUsd} / $${monthlyLimitUsd}). Job dijeda secara otomatis.`,
    };
  }

  return {
    allowed: true,
    spentTodayUsd,
    spentThisMonthUsd,
    dailyLimitUsd,
    monthlyLimitUsd,
    requestedAmountUsd: requested,
    reason: null,
  };
}
