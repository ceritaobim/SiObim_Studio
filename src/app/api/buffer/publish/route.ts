import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { publishContentToBuffer } from "@/lib/integrations/buffer-publisher";

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
    const contentId = String(body.contentId ?? "").trim();
    const targetPlatforms = Array.isArray(body.targetPlatforms)
      ? body.targetPlatforms.map((p: unknown) => String(p).toLowerCase().trim())
      : undefined;
    const scheduledTime = body.scheduledTime
      ? String(body.scheduledTime).trim()
      : undefined;
    const customCaption = body.customCaption
      ? String(body.customCaption).trim()
      : undefined;
    const publishNow = Boolean(body.publishNow);

    if (!contentId) {
      return NextResponse.json(
        { error: "Pilih konten yang ingin di-publish ke Buffer." },
        { status: 400 }
      );
    }

    const result = await publishContentToBuffer({
      ownerId: owner.ownerId,
      contentId,
      targetPlatforms,
      scheduledTime,
      customCaption,
      publishNow,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal memproses publikasi video ke Buffer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
