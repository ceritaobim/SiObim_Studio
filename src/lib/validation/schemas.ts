import { z } from "zod";

export const PlatformTargetSchema = z.enum(["tiktok", "youtube", "instagram"]);

export const VerificationStatusSchema = z.enum([
  "draft",
  "needs_verification",
  "verified",
  "rejected",
]);

export const ContentStatusSchema = z.enum([
  "idea",
  "planned",
  "script_approved",
  "in_production",
  "assembled",
  "approved",
  "ready_to_publish",
  "published",
  "archived",
]);

export const VideoGenerationModeSchema = z.enum([
  "semi_manual_flow",
  "api_provider",
]);

export const ProjectSettingsInputSchema = z
  .object({
    projectName: z.string().trim().min(2).max(120),
    channelName: z.string().trim().min(2).max(80),
    language: z.string().trim().min(2).max(20).default("id-ID"),
    timezone: z.string().trim().min(2).max(60).default("Asia/Makassar"),
    niche: z.string().trim().min(3).max(500),
    toneGuide: z.string().trim().min(3).max(1000),
    visualStyleGuide: z.string().trim().min(10).max(2000),
    characterDescription: z.string().trim().min(3).max(2000),
    defaultDurationSeconds: z.coerce.number().int().min(15).max(180),
    targetSceneSecondsMin: z.coerce.number().int().min(3).max(20),
    targetSceneSecondsMax: z.coerce.number().int().min(4).max(30),
    outputAspectRatio: z.literal("9:16").default("9:16"),
    outputWidth: z.coerce.number().int().min(720).max(2160).default(1080),
    outputHeight: z.coerce.number().int().min(1280).max(3840).default(1920),
    noSubtitles: z.boolean().default(true),
    weeklyVideoTarget: z.coerce.number().int().min(1).max(21),
    dailyBudgetLimit: z.coerce.number().min(0).max(10000),
    monthlyBudgetLimit: z.coerce.number().min(0).max(100000),
    maxSceneRetries: z.coerce.number().int().min(0).max(5),
    videoGenerationMode: VideoGenerationModeSchema.default("semi_manual_flow"),
    targetPlatforms: z
      .array(PlatformTargetSchema)
      .min(1, "Pilih minimal satu platform target"),
    googleSheetUrl: z.string().trim().max(1000).optional().default(""),
    googleSheetWebAppUrl: z.string().trim().max(1000).optional().default(""),
    defaultUploadHour: z.string().trim().max(50).optional().default("19:00 WIB"),
    notes: z.string().trim().max(5000).optional().default(""),
  })
  .refine(
    (val) => val.targetSceneSecondsMin <= val.targetSceneSecondsMax,
    {
      message: "Durasi scene minimum tidak boleh lebih besar dari maksimum",
      path: ["targetSceneSecondsMin"],
    }
  );

export type ProjectSettingsInput = z.input<typeof ProjectSettingsInputSchema>;

export const ContentItemInputSchema = z.object({
  contentCode: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9-_]{3,32}$/,
      "Kode konten harus berupa huruf/angka/strip (mis. CO-2026-001)"
    ),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(220),
  category: z.string().trim().min(2).max(100).default("Sains & Keingintahuan"),
  topic: z.string().trim().min(3, "Topik minimal 3 karakter").max(300),
  hook: z.string().trim().max(500).default(""),
  narration: z.string().trim().max(8000).default(""),
  cta: z
    .string()
    .trim()
    .max(300)
    .default("Apa pendapatmu? Tulis di kolom komentar!"),
  tiktokCaption: z.string().trim().max(2200).default(""),
  youtubeDescription: z.string().trim().max(5000).default(""),
  instagramCaption: z.string().trim().max(2200).default(""),
  notes: z.string().trim().max(2000).default(""),
  programName: z
    .enum(["Ke Dapur Yuk!", "Kepikiran Aja", "Eh, Ternyata!"])
    .optional(),
  targetDurationSeconds: z.coerce.number().int().min(15).max(180).default(28),
  factualClaims: z.array(z.string().trim().min(1)).default([]),
  sourceUrls: z.array(z.string().trim().min(1)).default([]),
  verificationStatus: VerificationStatusSchema.default("needs_verification"),
  contentStatus: ContentStatusSchema.default("idea"),
  sourceBatchId: z.string().nullable().optional().default(null),
  isDemo: z.boolean().optional().default(false),
  scheduledPublishAt: z.string().nullable().optional().default(null),
  publishedAt: z.string().nullable().optional().default(null),
});

export type ContentItemInput = z.output<typeof ContentItemInputSchema>;
export type ContentItemCreateParams = z.input<typeof ContentItemInputSchema>;

export const ContentItemUpdateSchema = ContentItemInputSchema.partial().extend({
  id: z.string().min(1),
});

export type ContentItemUpdateInput = z.infer<typeof ContentItemUpdateSchema>;

export const LLMGeneratedProposalSchema = z.object({
  title: z.string().trim().min(5).max(220),
  programName: z
    .enum(["Ke Dapur Yuk!", "Kepikiran Aja", "Eh, Ternyata!"])
    .optional(),
  category: z.string().trim().min(2).max(100).default("Sains & Keingintahuan"),
  topic: z.string().trim().min(5).max(300),
  hook: z.string().trim().min(5).max(500),
  narration: z.string().trim().min(20).max(8000),
  cta: z
    .string()
    .trim()
    .min(3)
    .max(300)
    .default("Apa pendapatmu? Tulis di kolom komentar!"),
  tiktokCaption: z.string().trim().max(2200).default(""),
  youtubeDescription: z.string().trim().max(5000).default(""),
  instagramCaption: z.string().trim().max(2200).default(""),
  targetDurationSeconds: z.coerce.number().int().min(15).max(180).default(28),
  factualClaims: z.array(z.string().trim().min(3)).default([]),
  sourceUrls: z.array(z.string().trim().url()).default([]),
  verificationStatus: VerificationStatusSchema.default("needs_verification"),
  scheduledPublishAt: z.string().nullable().optional(),
});

export const LLMContentPlanOutputSchema = z.object({
  proposals: z.array(LLMGeneratedProposalSchema).min(1).max(28),
});

export type LLMGeneratedProposal = z.infer<typeof LLMGeneratedProposalSchema>;

export const CreateBatchRequestSchema = z.object({
  batchName: z.string().trim().min(3).max(120),
  targetWeekStart: z.string().trim().min(8).max(30),
  targetVideoCount: z.coerce.number().int().min(1).max(28).default(21),
  customThemeHint: z.string().trim().max(400).optional().default(""),
});

export type CreateBatchRequest = z.infer<typeof CreateBatchRequestSchema>;

export const PlatformAnalyticsMetricsSchema = z.object({
  views: z.number().int().min(0).default(0),
  watchTimeHours: z.number().min(0).optional(),
  averageWatchTimeSeconds: z.number().min(0).optional(),
  averagePercentageViewed: z.number().min(0).max(100).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  saves: z.number().int().min(0).optional(),
  subscribersGained: z.number().int().min(0).optional(),
  reach: z.number().int().min(0).optional(),
  nonFollowerPercentage: z.number().min(0).max(100).optional(),
  ctrPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const ContentAnalyticsUpdateSchema = z.object({
  contentId: z.string().min(1, "contentId wajib diisi"),
  youtube: PlatformAnalyticsMetricsSchema.optional(),
  tiktok: PlatformAnalyticsMetricsSchema.optional(),
  instagram: PlatformAnalyticsMetricsSchema.optional(),
});

export type ContentAnalyticsUpdateInput = z.infer<typeof ContentAnalyticsUpdateSchema>;

