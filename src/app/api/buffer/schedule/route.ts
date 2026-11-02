import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  rescheduleContentInBuffer,
  cancelScheduledContentInBuffer,
} from "@/lib/integrations/buffer-publisher";

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
    const action = String(body.action || "").trim();
    const contentId = String(body.contentId || "").trim();
    const newScheduledTime = body.newScheduledTime
      ? String(body.newScheduledTime).trim()
      : undefined;

    if (!contentId) {
      return NextResponse.json(
        { error: "Parameter contentId diperlukan." },
        { status: 400 }
      );
    }

    if (action === "cancel") {
      const result = await cancelScheduledContentInBuffer({
        ownerId: owner.ownerId,
        contentId,
      });
      return NextResponse.json({
        ok: true,
        action: "cancel",
        deletedCount: result.deletedCount,
        errors: result.errors,
      });
    }

    if (action === "reschedule" || newScheduledTime) {
      if (!newScheduledTime) {
        return NextResponse.json(
          { error: "newScheduledTime diperlukan untuk memperbarui jadwal." },
          { status: 400 }
        );
      }

      const result = await rescheduleContentInBuffer({
        ownerId: owner.ownerId,
        contentId,
        newScheduledTime,
      });

      return NextResponse.json({
        ok: result.ok,
        action: "reschedule",
        updatedCount: result.updatedCount,
        errors: result.errors,
      });
    }

    return NextResponse.json(
      { error: "Aksi tidak dikenali. Gunakan 'reschedule' atau 'cancel'." },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gagal memproses jadwal Buffer.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
