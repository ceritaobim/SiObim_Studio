import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { syncBufferAnalyticsForPublishedItems } from "@/lib/services/analytics-sync-engine";
import {
  getAnalyticsSummary,
  listContentAnalytics,
  listOrInitializePublications,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const report = await syncBufferAnalyticsForPublishedItems(owner.ownerId, {
      notifyTelegram: true,
    });
    const [summary, analytics, publications] = await Promise.all([
      getAnalyticsSummary(owner.ownerId),
      listContentAnalytics(owner.ownerId),
      listOrInitializePublications(owner.ownerId),
    ]);
    return NextResponse.json({ ok: true, report, summary, analytics, publications });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menyinkronkan analitik Buffer.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

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
    const report = await syncBufferAnalyticsForPublishedItems(owner.ownerId);
    const [summary, analytics, publications] = await Promise.all([
      getAnalyticsSummary(owner.ownerId),
      listContentAnalytics(owner.ownerId),
      listOrInitializePublications(owner.ownerId),
    ]);
    return NextResponse.json({ ok: true, report, summary, analytics, publications });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Gagal menyinkronkan analitik Buffer.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
