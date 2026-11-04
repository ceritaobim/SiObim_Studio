import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  commitApprovedBatchProposals,
  createAndGenerateWeeklyBatch,
  getProjectSettings,
  listContentBatches,
  listContentItems,
  updateBatchProposal,
} from "@/lib/db/repository";
import { CreateBatchRequestSchema } from "@/lib/validation/schemas";
import { pushItemsToGoogleSheetWebApp } from "@/features/content-library/google-sheets-sync";
import { runAutopilotCycle } from "@/lib/services/autopilot-orchestrator";

export async function GET(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  const [batches, settings] = await Promise.all([
    listContentBatches(owner.ownerId),
    getProjectSettings(owner.ownerId),
  ]);

  return NextResponse.json({
    batches,
    settings,
  });
}

export async function POST(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = CreateBatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR: Data pembuatan batch tidak valid.",
          issues: parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        },
        { status: 400 }
      );
    }

    const batch = await createAndGenerateWeeklyBatch(
      owner.ownerId,
      parsed.data
    );

    if (body.autoCommit) {
      const targetWeekNumber =
        typeof body.targetWeekNumber === "number" && body.targetWeekNumber >= 1
          ? body.targetWeekNumber
          : undefined;

      const committed = await commitApprovedBatchProposals(
        owner.ownerId,
        batch.id,
        { commitAll: true, targetWeekNumber }
      );

      // Automatically sync to Google Spreadsheet & create Google Drive folders if Web App URL is configured
      let gsheetSyncMessage: string | null = null;
      const settings = await getProjectSettings(owner.ownerId);
      const targetWebAppUrl =
        settings.googleSheetWebAppUrl ||
        process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
        "";

      if (targetWebAppUrl) {
        try {
          const allItems = await listContentItems(owner.ownerId);
          const pushRes = await pushItemsToGoogleSheetWebApp(
            targetWebAppUrl,
            allItems
          );
          gsheetSyncMessage = pushRes.message;
        } catch (syncErr) {
          gsheetSyncMessage = `Tersimpan di web, namun auto-sync GDrive tertunda: ${
            syncErr instanceof Error ? syncErr.message : "Unknown error"
          }`;
        }
      }

      // Auto-trigger Fase 2: Generate TTS voice, alignment timestamps & visual scene prompts asynchronously
      runAutopilotCycle(owner.ownerId).catch((err) => {
        console.warn("Background auto-voice trigger warning:", err);
      });

      return NextResponse.json(
        {
          batch: committed.batch,
          appendedItems: committed.appendedItems,
          appendedCount: committed.appendedItems.length,
          gsheetSyncMessage,
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal menghasilkan perencanaan batch mingguan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const action = String(body.action ?? "update_proposal");

    if (action === "commit_approved" || action === "commit_batch") {
      const batchId = String(body.batchId ?? "");
      if (!batchId) {
        return NextResponse.json(
          { error: "batchId wajib diisi." },
          { status: 400 }
        );
      }

      const result = await commitApprovedBatchProposals(
        owner.ownerId,
        batchId,
        { commitAll: action === "commit_batch" }
      );

      // Optional auto-push to Google Sheet Web App if configured and requested
      let gsheetSyncMessage: string | null = null;
      const settings = await getProjectSettings(owner.ownerId);
      if (
        body.syncToGoogleSheet &&
        settings.googleSheetWebAppUrl &&
        result.appendedItems.length > 0
      ) {
        try {
          const pushRes = await pushItemsToGoogleSheetWebApp(
            settings.googleSheetWebAppUrl,
            result.appendedItems
          );
          gsheetSyncMessage = pushRes.message;
        } catch (syncErr) {
          gsheetSyncMessage = `Tersimpan di database, tetapi sinkronisasi GSheets gagal: ${
            syncErr instanceof Error ? syncErr.message : "Unknown error"
          }`;
        }
      }

      // Auto-trigger Fase 2: Generate TTS voice, alignment timestamps & visual scene prompts asynchronously
      runAutopilotCycle(owner.ownerId).catch((err) => {
        console.warn("Background auto-voice trigger warning:", err);
      });

      return NextResponse.json({
        batch: result.batch,
        appendedItems: result.appendedItems,
        appendedCount: result.appendedItems.length,
        gsheetSyncMessage,
      });
    }

    const updatedBatch = await updateBatchProposal(owner.ownerId, {
      batchId: String(body.batchId ?? ""),
      proposalId: String(body.proposalId ?? ""),
      decision: body.decision,
      title: body.title,
      topic: body.topic,
      hook: body.hook,
      narration: body.narration,
      cta: body.cta,
      sourceUrls: Array.isArray(body.sourceUrls) ? body.sourceUrls : undefined,
      factualClaims: Array.isArray(body.factualClaims)
        ? body.factualClaims
        : undefined,
      regenerate: Boolean(body.regenerate),
    });

    return NextResponse.json({ batch: updatedBatch });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui usulan batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
