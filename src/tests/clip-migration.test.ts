import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isAlreadyStandardNamed,
  detectRawClipContentAndScene,
  runTwoStepClipMigration,
} from "@/lib/services/clip-migration-engine";
import { listContentItems } from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";

describe("Two-Step Clip Migration & Duplicate Detection Engine", () => {
  let tmpRoot: string;
  let downloadsDir: string;
  let cleanStagingDir: string;
  let duplicateDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "co-migration-test-"));
    downloadsDir = path.join(tmpRoot, "Downloads");
    cleanStagingDir = path.join(tmpRoot, "KLIP_BERSIH");
    duplicateDir = path.join(tmpRoot, "KLIP_DUPLIKAT");

    fs.mkdirSync(downloadsDir, { recursive: true });
    fs.mkdirSync(cleanStagingDir, { recursive: true });
    fs.mkdirSync(duplicateDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  it("accurately classifies already-standard names vs raw names", async () => {
    const items = await listContentItems(DEFAULT_OWNER_ID, { forceLocal: true });

    // Standard cases
    const std1 = isAlreadyStandardNamed("CO-2026-001_SCENE_001.mp4", items);
    expect(std1.isStandard).toBe(true);
    expect(std1.contentCode).toBe("CO-2026-001");
    expect(std1.sceneIndex).toBe(1);

    const std2 = isAlreadyStandardNamed("CO-2026-023_BAGIAN_2 - Kenapa Goyang Kaki.mp4", items);
    expect(std2.isStandard).toBe(true);
    expect(std2.contentCode).toBe("CO-2026-023");
    expect(std2.sceneIndex).toBe(2);

    const std3 = isAlreadyStandardNamed("1_1_25_3.mp4", items);
    expect(std3.isStandard).toBe(true);
    expect(std3.contentCode).toBe("CO-2026-025");
    expect(std3.sceneIndex).toBe(3);

    // Non-standard raw cases
    const rawPzxc = isAlreadyStandardNamed("pzxc_3_4_23_1xx_6ffc1377.mp4", items);
    expect(rawPzxc.isStandard).toBe(false);

    const rawFlow = isAlreadyStandardNamed("Paper_figurine_devours_origami_p._d5794532.mp4", items);
    expect(rawFlow.isStandard).toBe(false);

    const nonVideo = isAlreadyStandardNamed("obim.jpg_574d47ca (1).jpg", items);
    expect(nonVideo.isStandard).toBe(false);
  });

  it("detects raw macro pzxc and Google Flow prompt titles accurately", async () => {
    const items = await listContentItems(DEFAULT_OWNER_ID, { forceLocal: true });

    // Macro pzxc detection
    const pz23 = await detectRawClipContentAndScene("pzxc_3_4_23_1xx_6ffc1377.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(pz23.matchedItem?.contentCode).toBe("CO-2026-023");
    expect(pz23.sceneIndex).toBe(1);

    const pz25 = await detectRawClipContentAndScene("pzxc_3_4_25_2xx_26143444.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(pz25.matchedItem?.contentCode).toBe("CO-2026-025");
    expect(pz25.sceneIndex).toBe(2);

    // Flow semantic detection: Pineapple (CO-2026-010)
    const flowPineapple = await detectRawClipContentAndScene("Paper_figurine_devours_origami_p._d5794532.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(flowPineapple.matchedItem?.contentCode).toBe("CO-2026-010");
    expect(flowPineapple.sceneIndex).toBe(1);

    // Flow semantic detection: Enzymes (CO-2026-010 Scene 2)
    const flowEnzymes = await detectRawClipContentAndScene("Paper_enzymes_activating_and_tin._0fd67a64.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(flowEnzymes.matchedItem?.contentCode).toBe("CO-2026-010");
    expect(flowEnzymes.sceneIndex).toBe(2);

    // Flow semantic detection: Lungs (CO-2026-042 Scene 2)
    const flowLungs = await detectRawClipContentAndScene("Paper_boy_reacts_to_lungs_955428e8.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(flowLungs.matchedItem?.contentCode).toBe("CO-2026-042");
    expect(flowLungs.sceneIndex).toBe(2);

    // Flow semantic detection: Tickling (CO-2026-041 Scene 1)
    const flowTickling = await detectRawClipContentAndScene("Paper_boy_observing_tickling_ani._7b0595a0.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(flowTickling.matchedItem?.contentCode).toBe("CO-2026-041");
    expect(flowTickling.sceneIndex).toBe(1);

    // Unmatched arbitrary video
    const unknown = await detectRawClipContentAndScene("gameplay_minecraft_survival_part_1.mp4", items, DEFAULT_OWNER_ID, { forceLocal: true });
    expect(unknown.matchedItem).toBeNull();
  });

  it("executes the full multi-stage migration pipeline and resolves duplicate clips", { timeout: 15000 }, async () => {
    // 1. Setup mock files in Downloads
    // File A: Already standard
    const fileStd = path.join(downloadsDir, "CO-2026-023_BAGIAN_3 - Kenapa Kita Suka Goyang-Goyangin Kaki Pas Duduk.mp4");
    fs.writeFileSync(fileStd, Buffer.alloc(1024 * 500, "STD_VIDEO")); // 500 KB

    // File B: Raw macro pzxc
    const filePzxc = path.join(downloadsDir, "pzxc_3_4_23_1xx_6ffc1377.mp4");
    fs.writeFileSync(filePzxc, Buffer.alloc(1024 * 600, "PZXC_VIDEO")); // 600 KB

    // File C1 & C2: DUPLICATES for Pineapple scene 2
    const fileDup1 = path.join(downloadsDir, "Paper_enzymes_activating_and_tin._0fd67a64.mp4");
    fs.writeFileSync(fileDup1, Buffer.alloc(1024 * 700, "DUP_SMALLER")); // 700 KB

    const fileDup2 = path.join(downloadsDir, "Paper_enzymes_activating_and_tin._0fd67a64 (1).mp4");
    fs.writeFileSync(fileDup2, Buffer.alloc(1024 * 850, "DUP_LARGER")); // 850 KB (better)

    // File D: Non-mp4 file (should be ignored)
    const fileJpg = path.join(downloadsDir, "obim.jpg_574d47ca (1).jpg");
    fs.writeFileSync(fileJpg, "IMAGE_DATA");

    // File E: Unknown mp4 (should stay in Downloads)
    const fileUnknown = path.join(downloadsDir, "unknown_unmatched_clip_xyz.mp4");
    fs.writeFileSync(fileUnknown, Buffer.alloc(1024 * 100, "UNKNOWN_VIDEO"));

    // 2. Run migration
    const report = await runTwoStepClipMigration({
      ownerId: DEFAULT_OWNER_ID,
      userDownloadsDir: downloadsDir,
      cleanClipsDir: cleanStagingDir,
      duplicateClipsDir: duplicateDir,
      forceLocalStore: true,
      skipIngest: true,
      skipAssembly: true, // test staging logic without ffmpeg
    });

    expect(report.scannedCount).toBe(5); // 5 mp4 files scanned (jpg ignored)
    expect(report.stage1Moved.length).toBe(1);
    expect(report.stage1Moved[0]?.originalFilename).toBe("CO-2026-023_BAGIAN_3 - Kenapa Kita Suka Goyang-Goyangin Kaki Pas Duduk.mp4");

    // Stage 2: 3 files detected and moved (filePzxc, fileDup1, fileDup2)
    expect(report.stage2Detected.length).toBe(3);

    // Stage 2: 1 unmatched file remained in Downloads
    expect(report.stage2Unmatched.length).toBe(1);
    expect(report.stage2Unmatched[0]?.filename).toBe("unknown_unmatched_clip_xyz.mp4");
    expect(fs.existsSync(fileUnknown)).toBe(true); // Left in Downloads!
    expect(fs.existsSync(fileJpg)).toBe(true); // JPG ignored in Downloads!

    // Stage 3: Duplicate resolution
    // Exactly 1 duplicate resolved for Pineapple scene 2
    expect(report.stage3Duplicates.length).toBe(1);
    expect(report.stage3Duplicates[0]?.contentCode).toBe("CO-2026-010");
    expect(report.stage3Duplicates[0]?.sceneIndex).toBe(2);

    // Check duplicate was moved to duplicateDir
    const dupEntries = fs.readdirSync(duplicateDir);
    expect(dupEntries.length).toBe(1);
    expect(dupEntries[0]).toContain("CO-2026-010_BAGIAN_2");

    // Check clean staging directory has only clean, unique canonical files
    const cleanEntries = fs.readdirSync(cleanStagingDir);
    expect(cleanEntries).toContain("CO-2026-023_BAGIAN_3 - Kenapa Kita Suka Goyang-Goyangin Kaki Pas Duduk.mp4");
    expect(cleanEntries).toContain("CO-2026-023_BAGIAN_1 - Kenapa Kita Suka Goyang-Goyangin Kaki Pas Duduk.mp4");
    expect(cleanEntries).toContain("CO-2026-010_BAGIAN_2 - Nanas Bisa 'Makan' Lidah Lo Balik!.mp4");
  });
});
