import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  exportFullProjectJson,
  listContentItems,
  listOrInitializePublications,
  updatePlatformPublication,
} from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import { getActiveVideoProvider } from "@/lib/providers/video/video-provider";
import manifest from "@/app/manifest";

describe("Milestone 6 & 7 — Publishing Center, Full Project Export, PWA & Video Provider Adapter", () => {
  it("initializes 3 platform publication packages (TikTok, YouTube Shorts, Instagram Reels) and requires manual confirmation before marking content published", async () => {
    const tmpStore = path.join(
      os.tmpdir(),
      `ceritaobim-m6-pub-${Date.now()}.json`
    );

    const items = await listContentItems(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });
    const content = items[0]!;

    const pubs = await listOrInitializePublications(
      DEFAULT_OWNER_ID,
      content.id,
      { storePath: tmpStore, forceLocal: true }
    );
    expect(pubs).toHaveLength(3);
    expect(pubs.map((p) => p.platform).sort()).toEqual([
      "instagram",
      "tiktok",
      "youtube",
    ]);

    // Update checklist and mark all 3 platforms as published manually
    for (const p of pubs) {
      const updated = await updatePlatformPublication(
        DEFAULT_OWNER_ID,
        {
          publicationId: p.id,
          publishStatus: "published",
          externalPostUrl: `https://example.com/${p.platform}/post-1`,
        },
        { storePath: tmpStore, forceLocal: true }
      );
      expect(updated.publishStatus).toBe("published");
      expect(updated.publishedAt).toBeTruthy();
    }

    const updatedItems = await listContentItems(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });
    const updatedContent = updatedItems.find((i) => i.id === content.id)!;
    expect(updatedContent.contentStatus).toBe("published");

    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  });

  it("exports full project JSON snapshot and provides valid PWA manifest + safe Milestone 7 video adapter", async () => {
    const tmpStore = path.join(
      os.tmpdir(),
      `ceritaobim-m6-export-${Date.now()}.json`
    );

    const exported = await exportFullProjectJson(DEFAULT_OWNER_ID, {
      storePath: tmpStore,
      forceLocal: true,
    });

    expect(exported.studioVersion).toBe("1.0.0");
    expect(exported.settings.channelName).toBe("cerita_obim");
    expect(exported.contentItems.length).toBeGreaterThanOrEqual(2);
    expect(exported.publications.length).toBeGreaterThanOrEqual(6);

    const pwaManifest = manifest();
    expect(pwaManifest.short_name).toBe("CeritaObim");
    expect(pwaManifest.display).toBe("standalone");

    const videoAdapter = getActiveVideoProvider();
    const caps = videoAdapter.getCapabilities();
    expect(caps.supportsAspectRatio9x16).toBe(true);
    expect(caps.mode).toBe("semi_manual_flow");

    if (fs.existsSync(tmpStore)) fs.unlinkSync(tmpStore);
  });
});
