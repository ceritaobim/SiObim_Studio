import fs from "fs";
import os from "os";
import path from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MockLLMProvider,
  validateAndSanitizeLLMPlanOutput,
} from "@/lib/providers/llm/llm-provider";
import {
  commitApprovedBatchProposals,
  createAndGenerateWeeklyBatch,
  listContentItems,
  updateBatchProposal,
} from "@/lib/db/repository";
import {
  buildGoogleSheetXlsxExportUrl,
  extractGoogleSpreadsheetId,
} from "@/features/content-library/google-sheets-sync";

describe("Milestone 2 — Weekly Content Planning & Google Sheets Sync", () => {
  let tempStorePath: string;
  const ownerId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "co-studio-m2-"));
    tempStorePath = path.join(tmpDir, "studio-store.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(path.dirname(tempStorePath), { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it("rejects invalid structured LLM output and marks missing sources as needs_verification", () => {
    expect(() =>
      validateAndSanitizeLLMPlanOutput({ proposals: [{ title: "Pendek" }] })
    ).toThrow(/INVALID_LLM_STRUCTURED_OUTPUT/);

    const repaired = validateAndSanitizeLLMPlanOutput({
      proposals: [
        {
          title: "Mengapa Air Laut Terasa Asin Sejak Jutaan Tahun?",
          category: "Sains",
          topic: "Siklus mineral garam dari batuan daratan ke samudra",
          hook: "Pernah penasaran kenapa air sungai tawar tapi air laut asin?",
          narration:
            "Air hujan yang turun ke bumi bersifat sedikit asam karena menyerap karbon dioksida di udara, lalu mengikis mineral garam dari batuan daratan.",
          cta: "Komen di bawah!",
          targetDurationSeconds: 70,
          factualClaims: ["Air hujan mengikis ion natrium dan klorida dari batuan."],
          sourceUrls: ["bukan-url-valid"], // Invalid URL should be stripped -> needs_verification
          verificationStatus: "verified",
        },
      ],
    });

    expect(repaired).toHaveLength(1);
    expect(repaired[0]?.sourceUrls).toHaveLength(0);
    expect(repaired[0]?.verificationStatus).toBe("needs_verification");
  });

  it("creates a weekly batch, supports approve/edit/regenerate, and appends approved proposals without overwriting old items", async () => {
    const beforeItems = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(beforeItems).toHaveLength(7); // CO-2026-001 through CO-2026-007 (Week 1)

    const batch = await createAndGenerateWeeklyBatch(
      ownerId,
      {
        batchName: "Batch Week 2",
        targetWeekStart: "2026-10-19",
        targetVideoCount: 3,
        customThemeHint: "Biologi & Alam",
      },
      {
        storePath: tempStorePath,
        forceLocal: true,
        llmProvider: new MockLLMProvider(),
      }
    );

    expect(batch.proposals).toHaveLength(3);
    expect(batch.proposals[0]?.suggestedCode).toBe("CO-2026-008");
    expect(batch.proposals[1]?.suggestedCode).toBe("CO-2026-009");

    // Approve first proposal, reject second, regenerate third
    await updateBatchProposal(
      ownerId,
      {
        batchId: batch.id,
        proposalId: batch.proposals[0]!.proposalId,
        decision: "approved",
        title: "Mengapa Gurita Memiliki 3 Jantung dan Darah Biru? (Edited)",
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    await updateBatchProposal(
      ownerId,
      {
        batchId: batch.id,
        proposalId: batch.proposals[1]!.proposalId,
        decision: "rejected",
      },
      { storePath: tempStorePath, forceLocal: true }
    );

    const afterRegen = await updateBatchProposal(
      ownerId,
      {
        batchId: batch.id,
        proposalId: batch.proposals[2]!.proposalId,
        regenerate: true,
      },
      {
        storePath: tempStorePath,
        forceLocal: true,
        llmProvider: new MockLLMProvider(),
      }
    );

    expect(afterRegen.proposals[0]?.decision).toBe("approved");
    expect(afterRegen.proposals[1]?.decision).toBe("rejected");
    expect(afterRegen.proposals[2]?.decision).toBe("pending");

    // Commit approved proposals -> only 1 approved item should be appended
    const commitRes = await commitApprovedBatchProposals(ownerId, batch.id, {
      storePath: tempStorePath,
      forceLocal: true,
    });

    expect(commitRes.appendedItems).toHaveLength(1);
    expect(commitRes.appendedItems[0]?.contentCode).toBe("CO-2026-022");
    expect(commitRes.appendedItems[0]?.contentStatus).toBe("script_approved");

    const afterItems = await listContentItems(ownerId, {
      storePath: tempStorePath,
      forceLocal: true,
    });
    expect(afterItems).toHaveLength(8); // 7 original Week 1 items + 1 newly appended
  });

  it("extracts Google Spreadsheet IDs and builds direct XLSX export URLs", () => {
    const parsed = extractGoogleSpreadsheetId(
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
    );
    expect(parsed?.spreadsheetId).toBe(
      "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    );
    expect(
      buildGoogleSheetXlsxExportUrl(
        "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
      )
    ).toBe(
      "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=xlsx"
    );
  });
});
