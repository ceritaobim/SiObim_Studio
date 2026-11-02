import { NextResponse } from "next/server";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  getAnalyticsSummary,
  listContentAnalytics,
  listContentItems,
} from "@/lib/db/repository";
import { evaluateContentAndGenerateGrowthPlan } from "@/lib/providers/llm/content-growth-evaluator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const [summary, analytics, items] = await Promise.all([
      getAnalyticsSummary(owner.ownerId),
      listContentAnalytics(owner.ownerId),
      listContentItems(owner.ownerId),
    ]);

    const evaluation = await evaluateContentAndGenerateGrowthPlan({
      summary,
      analytics,
      items,
    });

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menjalankan evaluasi analitik konten.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
