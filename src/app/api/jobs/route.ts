import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  addBudgetLedgerEntry,
  controlProductionJob,
  getProjectSettings,
  listBudgetLedger,
  listProductionJobs,
} from "@/lib/db/repository";
import {
  calculateBatchCostEstimate,
  evaluateBudgetGuard,
} from "@/lib/costs/budget-guard";

const ControlJobSchema = z.object({
  action: z.enum(["pause", "resume", "cancel", "retry", "add_ledger"]),
  jobId: z.string().uuid().optional(),
  providerKey: z.string().optional(),
  eventType: z.enum(["estimate", "reservation", "charge", "refund", "manual_note"]).optional(),
  amount: z.number().min(0).optional(),
  unit: z.enum(["USD", "CREDITS", "CHARACTERS", "SECONDS"]).optional(),
  notes: z.string().optional(),
  contentId: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId") || undefined;

    const settings = await getProjectSettings(owner.ownerId);
    const jobs = await listProductionJobs(owner.ownerId, contentId);
    const budgetLedger = await listBudgetLedger(owner.ownerId);

    const budgetSummary = evaluateBudgetGuard({
      settings,
      ledgerEntries: budgetLedger,
      requestedAmountUsd: 0,
    });

    const batchCostPreview = calculateBatchCostEstimate({
      videoCount: settings.weeklyVideoTarget,
      maxSceneRetries: settings.maxSceneRetries,
      videoMode: settings.videoGenerationMode,
      llmIsPaidApi: Boolean(process.env.LLM_API_KEY),
      ttsIsPaidApi: Boolean(process.env.TTS_API_KEY),
    });

    return NextResponse.json({
      jobs,
      budgetLedger,
      budgetSummary,
      batchCostPreview,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat antrean job dan buku besar anggaran.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const body = await request.json();
    const parsed = ControlJobSchema.parse(body);

    if (parsed.action === "add_ledger") {
      const entry = await addBudgetLedgerEntry(owner.ownerId, {
        contentId: parsed.contentId ?? null,
        providerKey: parsed.providerKey || "manual",
        eventType: parsed.eventType || "charge",
        amount: parsed.amount ?? 0,
        unit: parsed.unit || "USD",
        notes: parsed.notes || "Catatan biaya manual",
      });
      const settings = await getProjectSettings(owner.ownerId);
      const budgetLedger = await listBudgetLedger(owner.ownerId);
      const budgetSummary = evaluateBudgetGuard({
        settings,
        ledgerEntries: budgetLedger,
        requestedAmountUsd: 0,
      });
      return NextResponse.json({ entry, budgetLedger, budgetSummary });
    }

    if (!parsed.jobId) {
      return NextResponse.json(
        { error: "ID Job wajib disertakan untuk kontrol job." },
        { status: 400 }
      );
    }

    const updatedJob = await controlProductionJob(owner.ownerId, {
      jobId: parsed.jobId,
      action: parsed.action,
    });

    return NextResponse.json({ job: updatedJob });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses kontrol job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
