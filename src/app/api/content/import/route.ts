import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  appendImportedContentItems,
  listContentItems,
} from "@/lib/db/repository";
import { parseContentPlanSpreadsheet } from "@/features/content-library/xlsx-service";

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
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") ?? "preview");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Pilih file .xlsx atau .csv terlebih dahulu." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const existingItems = await listContentItems(owner.ownerId, {
      includeArchived: true,
    });

    const report = parseContentPlanSpreadsheet(
      Buffer.from(arrayBuffer),
      existingItems
    );

    if (mode !== "commit") {
      return NextResponse.json({
        mode: "preview",
        report,
      });
    }

    const validItems = report.rows
      .filter((r) => r.status === "valid_new" && r.item)
      .map((r) => r.item!);

    const commitResult = await appendImportedContentItems(
      owner.ownerId,
      validItems
    );

    const updatedItems = await listContentItems(owner.ownerId);

    return NextResponse.json({
      mode: "commit",
      report,
      commitResult,
      items: updatedItems,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses file impor XLSX.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
