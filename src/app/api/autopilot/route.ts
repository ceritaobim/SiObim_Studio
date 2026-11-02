import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { runAutopilotCycle } from "@/lib/services/autopilot-orchestrator";

export const dynamic = "force-dynamic";

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

  try {
    const report = await runAutopilotCycle(owner.ownerId);
    return NextResponse.json({ ok: true, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menjalankan Auto-Pilot cycle.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
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
    const report = await runAutopilotCycle(owner.ownerId);
    return NextResponse.json({ ok: true, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menjalankan Auto-Pilot cycle.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
