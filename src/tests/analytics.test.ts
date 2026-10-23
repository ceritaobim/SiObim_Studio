import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  listContentAnalytics,
  upsertContentAnalytics,
  getAnalyticsSummary,
} from "@/lib/db/repository";
import { ContentAnalyticsUpdateSchema } from "@/lib/validation/schemas";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";

const TEST_STORE_PATH = path.join(
  process.cwd(),
  ".data",
  "test-analytics-store.json"
);

describe("Cross-Platform Content Analytics Feature", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
  });

  it("initializes analytics with seeded metrics for demo content items", async () => {
    const list = await listContentAnalytics(DEFAULT_OWNER_ID, {
      storePath: TEST_STORE_PATH,
      forceLocal: true,
    });

    expect(list.length).toBeGreaterThan(0);
    const co002 = list.find((a) => a.youtube?.views === 1770);
    expect(co002).toBeDefined();
    expect(co002?.youtube?.watchTimeHours).toBe(13.3);
    expect(co002?.aiHookEvaluation?.hookStrength).toBe("viral");
  });

  it("calculates cross-platform analytics summary accurately", async () => {
    const summary = await getAnalyticsSummary(DEFAULT_OWNER_ID, {
      storePath: TEST_STORE_PATH,
      forceLocal: true,
    });

    expect(summary.totalViews).toBeGreaterThan(0);
    expect(summary.totalYoutubeViews).toBeGreaterThan(5000);
    expect(summary.totalWatchTimeHours).toBeGreaterThan(20);
    expect(summary.totalSubscribersGained).toBeGreaterThanOrEqual(12);
    expect(summary.topPerformingContent).toBeDefined();
    expect(summary.topPerformingContent?.totalViews).toBeGreaterThan(0);
  });

  it("updates analytics for a content item with recalculation of totals", async () => {
    const list = await listContentAnalytics(DEFAULT_OWNER_ID, {
      storePath: TEST_STORE_PATH,
      forceLocal: true,
    });
    const target = list[0];
    expect(target).toBeDefined();

    const updated = await upsertContentAnalytics(
      DEFAULT_OWNER_ID,
      {
        contentId: target!.contentId,
        youtube: {
          views: 2500,
          watchTimeHours: 18.5,
          likes: 120,
          subscribersGained: 15,
        },
        tiktok: {
          views: 1200,
          likes: 95,
          shares: 30,
        },
        instagram: {
          views: 800,
          likes: 45,
          saves: 20,
        },
      },
      { storePath: TEST_STORE_PATH, forceLocal: true }
    );

    expect(updated.totalViews).toBe(2500 + 1200 + 800); // 4500
    expect(updated.topPlatform).toBe("youtube");
    // 120 (yt likes) + 95 (tt likes) + 30 (tt shares) + 45 (ig likes) + 20 (ig saves) + 1 (preserved ig shares) = 311
    expect(updated.totalInteractions).toBe(311);
    expect(updated.youtube?.watchTimeHours).toBe(18.5);
  });

  it("validates server-side analytics update schema correctly", () => {
    const valid = ContentAnalyticsUpdateSchema.safeParse({
      contentId: "test-content-id",
      youtube: { views: 500, watchTimeHours: 4.2 },
      tiktok: { views: 300, likes: 25 },
    });
    expect(valid.success).toBe(true);

    const invalid = ContentAnalyticsUpdateSchema.safeParse({
      contentId: "", // empty
      youtube: { views: -10 }, // negative views
    });
    expect(invalid.success).toBe(false);
  });
});
