import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  appendImportedContentItems,
  getProjectSettings,
  listContentItems,
  saveProjectSettings,
} from "@/lib/db/repository";
import {
  fetchAndPreviewGoogleSheet,
  pushItemsToGoogleSheetWebApp,
} from "@/features/content-library/google-sheets-sync";

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
    const action = String(body.action ?? "pull_preview");
    const sheetUrl = String(body.googleSheetUrl ?? "").trim();
    const webAppUrl = String(body.googleSheetWebAppUrl ?? "").trim();

    // Persist URLs in settings if provided
    const currentSettings = await getProjectSettings(owner.ownerId);
    if (
      action === "save_urls" ||
      (sheetUrl && sheetUrl !== currentSettings.googleSheetUrl) ||
      (webAppUrl && webAppUrl !== currentSettings.googleSheetWebAppUrl)
    ) {
      await saveProjectSettings(owner.ownerId, {
        ...currentSettings,
        googleSheetUrl: sheetUrl || currentSettings.googleSheetUrl || "",
        googleSheetWebAppUrl:
          webAppUrl || currentSettings.googleSheetWebAppUrl || "",
      });
    }

    if (action === "save_urls") {
      return NextResponse.json({
        action: "save_urls",
        ok: true,
        message: "URL Google Spreadsheet & Web App berhasil disimpan!",
      });
    }

    if (action === "push" || action === "push_all") {
      const targetWebApp =
        webAppUrl ||
        currentSettings.googleSheetWebAppUrl ||
        process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
        "";
      const items = await listContentItems(owner.ownerId);
      const pushResult = await pushItemsToGoogleSheetWebApp(
        targetWebApp,
        items
      );
      return NextResponse.json({
        action: "push",
        ...pushResult,
      });
    }

    const targetSheetUrl =
      sheetUrl ||
      currentSettings.googleSheetUrl ||
      process.env.GOOGLE_SHEET_URL ||
      "";
    const existingItems = await listContentItems(owner.ownerId, {
      includeArchived: true,
    });

    const report = await fetchAndPreviewGoogleSheet(
      targetSheetUrl,
      existingItems
    );

    if (action === "pull_commit") {
      const validItems = report.rows
        .filter((r) => r.status === "valid_new" && r.item)
        .map((r) => r.item!);

      const commitResult = await appendImportedContentItems(
        owner.ownerId,
        validItems
      );
      const updatedItems = await listContentItems(owner.ownerId);

      return NextResponse.json({
        action: "pull_commit",
        insertedCount: commitResult.insertedCount,
        report,
        commitResult,
        items: updatedItems,
      });
    }

    return NextResponse.json({
      action: "pull_preview",
      report,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal melakukan sinkronisasi Google Spreadsheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
