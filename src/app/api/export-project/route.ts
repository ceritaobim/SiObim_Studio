import { NextResponse } from "next/server";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import { exportFullProjectJson } from "@/lib/db/repository";

export async function GET(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const snapshot = await exportFullProjectJson(owner.ownerId);
    const filename = `CeritaObim_Studio_Project_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mengekspor data proyek.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
