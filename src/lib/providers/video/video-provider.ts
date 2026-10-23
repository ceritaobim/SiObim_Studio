import type { VideoGenerationMode } from "@/types/domain";

export interface VideoProviderCapabilities {
  providerKey: string;
  modelName: string;
  mode: VideoGenerationMode;
  configured: boolean;
  supportsAspectRatio9x16: boolean;
  supportsCharacterReferenceImages: boolean;
  supportsSceneContinuity: boolean;
  unitCostUsdPerClip: number | null; // null = UNKNOWN external cost
  statusSummary: string;
}

export interface VideoClipGenerationRequest {
  contentCode: string;
  sceneIndex: number;
  promptText: string;
  durationSeconds: number;
  aspectRatio: "9:16";
  characterReferenceUrls?: string[];
}

export interface VideoClipGenerationResult {
  providerKey: string;
  providerModel: string;
  providerRequestId: string;
  status: "succeeded" | "requires_semi_manual_flow";
  clipUrl: string | null;
  estimatedCostUsd: number | null;
  message: string;
}

export interface VideoProvider {
  readonly providerKey: string;
  readonly modelName: string;
  getCapabilities(): VideoProviderCapabilities;
  generateSceneClip(
    req: VideoClipGenerationRequest
  ): Promise<VideoClipGenerationResult>;
}

/**
 * Default Safe Adapter: Semi-Manual Google Flow Mode (Milestone 4) with
 * Optional Official Video API Adapter Readiness (Milestone 7).
 * Never fakes an undocumented API or rotates personal Google accounts.
 */
export class SafeVideoProviderAdapter implements VideoProvider {
  readonly providerKey: string;
  readonly modelName: string;
  private readonly apiKey: string | undefined;

  constructor(overrideProfileId?: string) {
    let profileGflowKey = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getActiveProviderProfile } = require("@/lib/providers/account-profiles") as typeof import("@/lib/providers/account-profiles");
      profileGflowKey = (
        getActiveProviderProfile(overrideProfileId).gflowApiKey || ""
      ).trim();
    } catch {
      profileGflowKey = "";
    }

    this.apiKey = profileGflowKey || process.env.VIDEO_PROVIDER_API_KEY;
    this.providerKey = this.apiKey
      ? "official-video-api-adapter"
      : "google-flow-semi-manual";
    this.modelName =
      process.env.VIDEO_PROVIDER_MODEL || "veo-origami-9x16-manual-pack";
  }

  getCapabilities(): VideoProviderCapabilities {
    if (!this.apiKey) {
      return {
        providerKey: this.providerKey,
        modelName: this.modelName,
        mode: "semi_manual_flow",
        configured: false,
        supportsAspectRatio9x16: true,
        supportsCharacterReferenceImages: true,
        supportsSceneContinuity: true,
        unitCostUsdPerClip: 0,
        statusSummary:
          "Mode Semi-Manual Google Flow Aktif (Rekomendasi MVP). Tidak memerlukan kunci API video berbayar dan tidak melanggar kuota/ketentuan akun.",
      };
    }

    return {
      providerKey: this.providerKey,
      modelName: this.modelName,
      mode: "api_provider",
      configured: true,
      supportsAspectRatio9x16: true,
      supportsCharacterReferenceImages: true,
      supportsSceneContinuity: true,
      unitCostUsdPerClip: null, // Explicitly marked UNKNOWN until provider billing rate is verified
      statusSummary:
        "Adapter API Video Resmi terdeteksi. Biaya per klip berstatus UNKNOWN hingga tarif resmi provider dikonfirmasi.",
    };
  }

  async generateSceneClip(
    req: VideoClipGenerationRequest
  ): Promise<VideoClipGenerationResult> {
    if (!this.apiKey) {
      return {
        providerKey: this.providerKey,
        providerModel: this.modelName,
        providerRequestId: `flow-manual-${req.contentCode}-s${req.sceneIndex}`,
        status: "requires_semi_manual_flow",
        clipUrl: null,
        estimatedCostUsd: 0,
        message:
          "Gunakan paket prompt TXT/CSV/XLSX pada menu Assets & Flow untuk membuat klip di Google Flow lalu unggah kembali.",
      };
    }

    return {
      providerKey: this.providerKey,
      providerModel: this.modelName,
      providerRequestId: `video-api-preview-${Date.now()}`,
      status: "requires_semi_manual_flow",
      clipUrl: null,
      estimatedCostUsd: null,
      message:
        "Endpoint API video langsung memerlukan verifikasi skema provider resmi. Beralih otomatis ke paket prompt Semi-Manual Google Flow agar produksi tidak terhenti.",
    };
  }
}

export function getActiveVideoProvider(): VideoProvider {
  return new SafeVideoProviderAdapter();
}
