import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listFlowProfileAccounts,
  saveFlowProfileAccounts,
  updateSingleFlowProfileCredit,
} from "@/lib/providers/flow-accounts-service";

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

  const accounts = listFlowProfileAccounts();
  const totalCredits = accounts.reduce((sum, a) => sum + a.credits, 0);
  const totalMaxCredits = accounts.reduce((sum, a) => sum + a.maxCredits, 0);
  const healthyCount = accounts.filter((a) => a.status === "healthy").length;
  const warningCount = accounts.filter((a) => a.status === "warning").length;
  const dangerCount = accounts.filter((a) => a.status === "danger").length;

  return NextResponse.json({
    ok: true,
    accounts,
    summary: {
      totalAccounts: accounts.length,
      totalCredits,
      totalMaxCredits,
      overallPercentage: Math.round((totalCredits / (totalMaxCredits || 1)) * 100),
      healthyCount,
      warningCount,
      dangerCount,
      estimatedVideosReady: Math.floor(totalCredits / 3),
    },
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

    // Mode 1: Single profile credit update
    if (typeof body.profileIndex === "number" && typeof body.credits === "number") {
      const updated = updateSingleFlowProfileCredit(
        body.profileIndex,
        body.credits,
        body.notes
      );
      if (!updated) {
        return NextResponse.json(
          { error: `Profil ${body.profileIndex} tidak ditemukan.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ ok: true, account: updated });
    }

    // Mode 2: Bulk accounts update
    if (Array.isArray(body.accounts)) {
      saveFlowProfileAccounts(body.accounts);
      const accounts = listFlowProfileAccounts();
      return NextResponse.json({ ok: true, accounts });
    }

    return NextResponse.json(
      { error: "Format request tidak valid. Sertakan profileIndex dan credits." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
