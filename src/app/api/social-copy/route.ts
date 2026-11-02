import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  listContentItems,
  updateContentItem,
} from "@/lib/db/repository";
import {
  generateSocialCopyForContent,
  type SocialCopyTone,
} from "@/lib/providers/llm/social-copy-generator";

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
    const action = String(body.action || "generate").toLowerCase();
    const contentId = String(body.contentId || "").trim();

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId wajib disertakan." },
        { status: 400 }
      );
    }

    const items = await listContentItems(owner.ownerId);
    const content = items.find(
      (i) =>
        i.id === contentId ||
        i.contentCode.toUpperCase() === contentId.toUpperCase()
    );
    if (!content) {
      return NextResponse.json(
        { error: `Konten ID atau Kode "${contentId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    // Action 1: Generate via Gemini AI
    if (action === "generate") {
      const tone = (body.tone as SocialCopyTone) || "viral_curiosity";
      const generated = await generateSocialCopyForContent(content, tone);
      return NextResponse.json({
        ok: true,
        contentId: content.id,
        contentCode: content.contentCode,
        generated,
      });
    }

    // Action 2: Save custom edits directly into DB
    if (action === "save") {
      const updated = await updateContentItem(owner.ownerId, {
        id: content.id,
        title: body.title ? String(body.title).trim() : undefined,
        hook: body.hook ? String(body.hook).trim() : undefined,
        tiktokCaption: body.tiktokCaption
          ? String(body.tiktokCaption).trim()
          : undefined,
        youtubeDescription: body.youtubeDescription
          ? String(body.youtubeDescription).trim()
          : undefined,
        instagramCaption: body.instagramCaption
          ? String(body.instagramCaption).trim()
          : undefined,
      });

      return NextResponse.json({
        ok: true,
        message: "Copy & caption postingan berhasil disimpan ke database!",
        content: updated,
      });
    }

    return NextResponse.json(
      { error: `Action "${action}" tidak dikenal.` },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memproses copy sosmed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
