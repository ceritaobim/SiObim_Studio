import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROJECT_SETTINGS,
  getServerProviderStatuses,
} from "@/lib/config/env";
import { PRIMARY_NAV_ITEMS } from "@/lib/navigation";

describe("Milestone 0 — Foundation & Provider Status Honesty", () => {
  it("provides Indonesian default project settings with origami stop-motion style and 9:16 output", () => {
    expect(DEFAULT_PROJECT_SETTINGS.language).toBe("id-ID");
    expect(DEFAULT_PROJECT_SETTINGS.channelName).toBe("cerita_obim");
    expect(DEFAULT_PROJECT_SETTINGS.outputAspectRatio).toBe("9:16");
    expect(DEFAULT_PROJECT_SETTINGS.outputWidth).toBe(1080);
    expect(DEFAULT_PROJECT_SETTINGS.outputHeight).toBe(1920);
    expect(DEFAULT_PROJECT_SETTINGS.noSubtitles).toBe(true);
    expect(DEFAULT_PROJECT_SETTINGS.defaultDurationSeconds).toBe(70);
    expect(DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMin).toBe(6);
    expect(DEFAULT_PROJECT_SETTINGS.targetSceneSecondsMax).toBe(10);
    expect(
      DEFAULT_PROJECT_SETTINGS.visualStyleGuide.toLowerCase()
    ).toContain("origami");
  });

  it("never falsely claims any provider is connected in Milestone 0 even when env vars are empty or set", () => {
    const emptyStatuses = getServerProviderStatuses({});
    expect(emptyStatuses.length).toBeGreaterThanOrEqual(6);
    for (const status of emptyStatuses) {
      expect(status.connected).toBe(false);
      expect(status.configuredInEnv).toBe(false);
    }

    const flowStatus = emptyStatuses.find((s) => s.key === "google_flow");
    expect(flowStatus?.modeLabel).toContain("Semi-Manual");

    const configuredStatuses = getServerProviderStatuses({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      LLM_PROVIDER: "gemini",
      LLM_API_KEY: "secret-key",
    });

    const supabase = configuredStatuses.find((s) => s.key === "supabase");
    expect(supabase?.configuredInEnv).toBe(true);
    // Must still be false until an explicit connection test passes
    expect(supabase?.connected).toBe(false);
  });

  it("includes all streamlined navigation routes (Monitor, Content Planning, Audio, Video, Characters, Upload, Dashboard, Settings)", () => {
    const hrefs = PRIMARY_NAV_ITEMS.map((item) => item.href);
    expect(hrefs).toEqual([
      "/",
      "/content",
      "/production",
      "/assets",
      "/characters",
      "/publishing",
      "/analytics",
      "/models-usage",
      "/settings",
    ]);
  });
});
