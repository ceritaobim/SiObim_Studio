import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertOwnerAccess,
  getAuthorizedOwner,
  verifyStudioLoginCredentials,
  isHostedStudio,
} from "@/lib/auth/owner-auth";
import {
  appendImportedContentItems,
  createContentItem,
  getProjectSettings,
  listContentItems,
  saveProjectSettings,
  updateContentItem,
} from "@/lib/db/repository";
import {
  buildContentPlanWorkbookBuffer,
  CONTENT_PLAN_COLUMNS,
  parseContentPlanSpreadsheet,
} from "@/features/content-library/xlsx-service";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";
import { DEFAULT_PROJECT_SETTINGS } from "@/lib/config/env";

describe("Milestone 1 — Auth, Database, Settings, Content Library & XLSX", () => {
  let tempStorePath: string;
  const ownerA = "00000000-0000-0000-0000-000000000001";
  const ownerB = "00000000-0000-0000-0000-000000000999";

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "co-studio-test-"));
    tempStorePath = path.join(tmpDir, "studio-store.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(tempStorePath), { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it("enforces owner-only access and rejects cross-owner mutations (RLS / Authorization)", async () => {
    const authCtx = await getAuthorizedOwner({ overrideOwnerId: ownerA });
    expect(authCtx.authorized).toBe(true);
    expect(authCtx.ownerId).toBe(ownerA);

    expect(() => assertOwnerAccess(ownerA, ownerA)).not.toThrow();
    expect(() => assertOwnerAccess(ownerA, ownerB)).toThrow(
      /FORBIDDEN_OWNER_MISMATCH/
    );

    const itemsA = await listContentItems(ownerA, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(itemsA).toHaveLength(7);
    expect(itemsA.every((i) => !i.isDemo)).toBe(true);

    // Owner B cannot see Owner A's content items
    const itemsB = await listContentItems(ownerB, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(itemsB).toHaveLength(0);

    // Owner B cannot update Owner A's content item
    await expect(
      updateContentItem(
        ownerB,
        { id: itemsA[0]!.id, title: "Hacked Title" },
        { storePath: tempStorePath, forceLocal: true }
      )
    ).rejects.toThrow(/FORBIDDEN_OWNER_MISMATCH/);
  });

  it("persists project settings updates across reads", async () => {
    const initial = await getProjectSettings(ownerA, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(initial.defaultDurationSeconds).toBe(28);

    await saveProjectSettings(
      ownerA,
      {
        ...DEFAULT_PROJECT_SETTINGS,
        defaultDurationSeconds: 75,
        weeklyVideoTarget: 3,
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    const reloaded = await getProjectSettings(ownerA, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(reloaded.defaultDurationSeconds).toBe(75);
    expect(reloaded.weeklyVideoTarget).toBe(3);
  });

  it("prevents overwriting existing content codes and downgrades unverified claims without source URLs", async () => {
    const created = await createContentItem(
      ownerA,
      {
        contentCode: "CO-2026-010",
        title: "Mengapa Langit Berwarna Biru di Siang Hari?",
        category: "Fisika",
        topic: "Hamburan Rayleigh oleh molekul atmosfer bumi",
        hook: "Pernah penasaran kenapa langit siang biru tapi sore jadi jingga?",
        narration: "Cahaya matahari terdiri dari berbagai panjang gelombang...",
        cta: "Tulis pendapatmu!",
        tiktokCaption: "",
        youtubeDescription: "",
        instagramCaption: "",
        notes: "",
        targetDurationSeconds: 68,
        factualClaims: ["Hamburan Rayleigh menyebarkan cahaya biru lebih kuat."],
        sourceUrls: [], // Empty source URLs!
        verificationStatus: "verified", // Should automatically downgrade to needs_verification
        contentStatus: "idea",
        isDemo: false,
        publishedAt: null,
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    expect(created.verificationStatus).toBe("needs_verification");

    // Attempting to create another item with the same contentCode must fail
    await expect(
      createContentItem(
        ownerA,
        {
          contentCode: "CO-2026-010",
          title: "Judul Lain yang Mencoba Menimpa",
          category: "Fisika",
          topic: "Topik lain",
          hook: "",
          narration: "",
          cta: "",
          tiktokCaption: "",
          youtubeDescription: "",
          instagramCaption: "",
          notes: "",
          targetDurationSeconds: 70,
          factualClaims: [],
          sourceUrls: [],
          verificationStatus: "draft",
          contentStatus: "idea",
          isDemo: false,
          publishedAt: null,
        },
        { storePath: tempStorePath, forceLocal: true }
      )
    ).rejects.toThrow(/DUPLICATE_CONTENT_CODE/);
  });

  it("detects duplicate/similar topics and supports non-destructive XLSX roundtrip", async () => {
    const existing = await listContentItems(ownerA, {
      storePath: tempStorePath,
      forceLocal: true,
    });

    // Check topic similarity against CO-2026-001 (Kenapa Temen Makin Dikit Pas Dewasa / Socioemotional Selectivity Theory)
    const warnings = findDuplicateTopicWarnings(
      {
        title: "Kenapa Temen Nongkrong Makin Dikit Saat Dewasa?",
        topic:
          "Socioemotional Selectivity Theory tentang lingkaran pertemanan yang mengecil saat dewasa",
      },
      existing
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]?.existingCode).toBe("CO-2026-001");

    // Also verify template file `templates/contentplan_template.xlsx` skips placeholder CO-YYYY-001
    const templateBuffer = fs.readFileSync(
      path.join(process.cwd(), "templates", "contentplan_template.xlsx")
    );
    const templatePreview = parseContentPlanSpreadsheet(
      templateBuffer,
      existing
    );
    expect(templatePreview.skippedPlaceholderCount).toBe(1);
    expect(templatePreview.validNewCount).toBe(0);

    // Build an export workbook containing 1 existing item (CO-2026-001) and 1 brand new item (CO-2026-055)
    const exportBuffer = buildContentPlanWorkbookBuffer([
      existing[0]!,
      {
        ...existing[0]!,
        id: "new-id",
        contentCode: "CO-2026-055",
        title: "Mengapa Burung Hantu Bisa Memutar Kepala 270 Derajat?",
        topic: "Struktur tulang leher dan pembuluh darah burung hantu",
      },
    ]);

    expect(CONTENT_PLAN_COLUMNS).toHaveLength(17);

    const previewReport = parseContentPlanSpreadsheet(exportBuffer, existing);
    expect(previewReport.conflictCodeCount).toBe(1); // CO-2026-001 flagged as conflict
    expect(previewReport.validNewCount).toBe(1); // CO-2026-055 is valid new

    const validToAppend = previewReport.rows
      .filter((r) => r.status === "valid_new" && r.item)
      .map((r) => r.item!);

    const commitRes = await appendImportedContentItems(ownerA, validToAppend, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(commitRes.insertedCount).toBe(1);

    const afterImport = await listContentItems(ownerA, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(afterImport.some((i) => i.contentCode === "CO-2026-055")).toBe(true);
    // Original CO-2026-001 is still intact and untouched
    expect(
      afterImport.find((i) => i.contentCode === "CO-2026-001")?.title
    ).toContain("Kenapa Temen Makin Dikit");
  });

  it("authenticates hosted credentials 'siobim' / 'siobim1' and distinguishes local vs hosted", () => {
    // Valid hosted credentials
    expect(verifyStudioLoginCredentials("siobim", "siobim1")).toBe(true);
    expect(verifyStudioLoginCredentials("Siobim", "siobim1")).toBe(true);
    expect(verifyStudioLoginCredentials("SIOBIM", "siobim1")).toBe(true);

    // Invalid credentials
    expect(verifyStudioLoginCredentials("siobim", "wrongpass")).toBe(false);
    expect(verifyStudioLoginCredentials("unknown_user", "siobim1")).toBe(false);

    // Local host detection (tidak menggunakan login page)
    expect(isHostedStudio("localhost:3000")).toBe(false);
    expect(isHostedStudio("127.0.0.1:3000")).toBe(false);
    expect(isHostedStudio("192.168.1.50:3000")).toBe(false);

    // Hosted cloud detection (memiliki login page)
    expect(isHostedStudio("siobim-studio.vercel.app")).toBe(true);
    expect(isHostedStudio("studio.ceritaobim.com")).toBe(true);
  });
});
