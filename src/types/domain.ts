export type VerificationStatus =
  | "draft"
  | "needs_verification"
  | "verified"
  | "rejected";

export type ContentStatus =
  | "idea"
  | "planned"
  | "script_approved"
  | "in_production"
  | "assembled"
  | "approved"
  | "ready_to_publish"
  | "published"
  | "archived";

export type JobStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "paused";

export type JobStepType =
  | "weekly_planning"
  | "tts_synthesis"
  | "synthesize_voice"
  | "scene_segmentation"
  | "prompt_generation"
  | "ffmpeg_assembly"
  | "assemble_video";

export type TimestampStatus = "actual" | "estimated" | "manually_adjusted";

export type PlatformTarget = "tiktok" | "youtube" | "instagram";
export type PlatformName = PlatformTarget;

export type PublicationStatus =
  | "not_prepared"
  | "prepared"
  | "scheduled_manually"
  | "published"
  | "failed";

export type PublishStatus =
  | "draft"
  | "ready_for_manual_upload"
  | "scheduled"
  | "published";

export type VideoGenerationMode = "semi_manual_flow" | "api_provider";

export interface ProjectSettingsSummary {
  id?: string;
  ownerId?: string;
  projectName: string;
  channelName: string;
  language: string;
  timezone: string;
  niche: string;
  toneGuide: string;
  visualStyleGuide: string;
  characterDescription: string;
  characterReferenceAssetIds: string[];
  defaultDurationSeconds: number;
  targetSceneSecondsMin: number;
  targetSceneSecondsMax: number;
  outputAspectRatio: "9:16";
  outputWidth: number;
  outputHeight: number;
  noSubtitles: boolean;
  weeklyVideoTarget: number;
  dailyBudgetLimit: number;
  monthlyBudgetLimit: number;
  maxSceneRetries: number;
  videoGenerationMode: VideoGenerationMode;
  targetPlatforms: PlatformTarget[];
  googleSheetUrl?: string;
  googleSheetWebAppUrl?: string;
  updatedAt?: string;
}

export interface ContentItemRecord {
  id: string;
  ownerId: string;
  contentCode: string;
  title: string;
  category: string;
  topic: string;
  hook: string;
  narration: string;
  cta: string;
  tiktokCaption: string;
  youtubeDescription: string;
  instagramCaption: string;
  notes: string;
  targetDurationSeconds: number;
  factualClaims: string[];
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  contentStatus: ContentStatus;
  sourceBatchId: string | null;
  isDemo: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateTopicWarning {
  existingCode: string;
  existingTitle: string;
  existingTopic: string;
  similarityScore: number;
  reason: string;
}

export type ProposalDecision = "pending" | "approved" | "rejected";

export interface WeeklyPlanProposal {
  proposalId: string;
  suggestedCode: string;
  title: string;
  category: string;
  topic: string;
  hook: string;
  narration: string;
  cta: string;
  tiktokCaption: string;
  youtubeDescription: string;
  instagramCaption: string;
  targetDurationSeconds: number;
  factualClaims: string[];
  sourceUrls: string[];
  verificationStatus: VerificationStatus;
  decision: ProposalDecision;
  duplicateWarnings: DuplicateTopicWarning[];
  committedContentId?: string | null;
}

export interface ContentBatchRecord {
  id: string;
  ownerId: string;
  batchName: string;
  targetWeekStart: string;
  targetVideoCount: number;
  status: "draft" | "planning_ready" | "approved" | "in_production" | "completed";
  providerKey: string;
  providerModel: string;
  providerRequestId: string | null;
  estimatedTotalCost: number;
  actualTotalCost: number | null;
  proposals: WeeklyPlanProposal[];
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WordAlignmentSpan {
  word: string;
  startMs: number;
  endMs: number;
}

export interface SceneRecord {
  id: string;
  contentId: string;
  sceneIndex: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  narrationText: string;
  visualAction: string;
  sfxCue?: string;
  cameraDirection: string;
  continuityNotes: string;
  promptText: string;
  expectedFilename: string;
  timestampStatus: TimestampStatus;
  sceneStatus: "segmented" | "prompt_ready" | "clip_uploaded" | "validated";
  durationFlag: "ok" | "too_short" | "too_long";
  uploadedClipAssetId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AssetType =
  | "reference_image"
  | "voice_audio"
  | "scene_video"
  | "final_video"
  | "assembly_log"
  | "thumbnail"
  | "export"
  | "log";

export interface AssetRecord {
  id: string;
  ownerId: string;
  contentId: string | null;
  sceneId: string | null;
  assetType: AssetType;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  checksum: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProductionJobRecord {
  id: string;
  ownerId: string;
  batchId: string | null;
  contentId: string | null;
  sceneId: string | null;
  jobType: JobStepType;
  status: JobStatus;
  providerKey: string;
  providerModel: string;
  providerRequestId: string | null;
  inputHash: string;
  idempotencyKey: string;
  progressPercent: number;
  attemptCount: number;
  maxAttempts: number;
  estimatedCost: number;
  actualCost: number | null;
  costUnit?: string;
  currencyOrCreditUnit?: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  safeErrorMessage: string | null;
  retryable: boolean;
  outputAssetIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type BudgetEventType =
  | "estimate"
  | "reservation"
  | "charge"
  | "refund"
  | "manual_note"
  | "manual_balance_update";

export interface BudgetLedgerRecord {
  id: string;
  ownerId: string;
  batchId?: string | null;
  contentId?: string | null;
  jobId: string | null;
  providerKey: string;
  model?: string;
  eventType: BudgetEventType;
  amount: number;
  unit: string;
  notes?: string;
  source?: "provider_api" | "user_entered" | "estimate";
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformPublicationRecord {
  id: string;
  contentId: string;
  platform: PlatformTarget;
  ExportAssetId: string | null;
  titleOrHook: string;
  captionText: string;
  hashtags: string;
  ctaText: string;
  checklist: Record<string, boolean>;
  scheduledAt: string | null;
  publishStatus: PublishStatus;
  publishedAt: string | null;
  externalPostUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatusSummary {
  key: string;
  displayName: string;
  category: "database" | "llm" | "tts" | "video" | "worker" | "publishing";
  modeLabel: string;
  connected: boolean;
  configuredInEnv: boolean;
  notes: string;
}

export interface StorageBackendStatus {
  mode: "supabase_postgres" | "local_file_fallback";
  supabaseConfigured: boolean;
  supabaseTableReady: boolean;
  message: string;
}

export interface PlatformAnalyticsMetrics {
  views: number;
  watchTimeHours?: number;
  averageWatchTimeSeconds?: number;
  averagePercentageViewed?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  subscribersGained?: number;
  reach?: number;
  nonFollowerPercentage?: number;
  ctrPercentage?: number;
  lastUpdated?: string;
  notes?: string;
}

export interface ContentAnalyticsRecord {
  id: string;
  contentId: string;
  ownerId: string;
  youtube?: PlatformAnalyticsMetrics;
  tiktok?: PlatformAnalyticsMetrics;
  instagram?: PlatformAnalyticsMetrics;
  totalViews: number;
  totalInteractions: number;
  topPlatform?: PlatformTarget;
  aiHookEvaluation?: {
    hookStrength: "viral" | "strong" | "moderate" | "needs_work";
    topicCategory: string;
    keySuccessFactor?: string;
    actionableAdvice?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSummary {
  totalViews: number;
  totalYoutubeViews: number;
  totalTiktokViews: number;
  totalInstagramViews: number;
  totalWatchTimeHours: number;
  totalInteractions: number;
  totalSubscribersGained: number;
  topPerformingContent?: {
    contentCode: string;
    title: string;
    totalViews: number;
    platform: PlatformTarget;
  } | null;
}

