import { NextResponse } from "next/server";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  listContentAnalytics,
  listContentItems,
  getAnalyticsSummary,
  upsertContentAnalytics,
} from "@/lib/db/repository";
import { ContentAnalyticsUpdateSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const [summary, analytics, items] = await Promise.all([
      getAnalyticsSummary(owner.ownerId),
      listContentAnalytics(owner.ownerId),
      listContentItems(owner.ownerId),
    ]);

    return NextResponse.json({
      summary,
      analytics,
      items,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat analitik konten.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const body = await request.json();
    const parsed = ContentAnalyticsUpdateSchema.parse(body);

    const updated = await upsertContentAnalytics(owner.ownerId, parsed);
    const summary = await getAnalyticsSummary(owner.ownerId);

    return NextResponse.json({
      success: true,
      updated,
      summary,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui analitik konten.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
