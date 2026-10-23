import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveAuthenticatedOwner } from "@/lib/auth/owner-auth";
import {
  listAssetsForContent,
  listContentItems,
  listOrInitializePublications,
  updatePlatformPublication,
} from "@/lib/db/repository";

const UpdatePublicationSchema = z.object({
  publicationId: z.string().uuid("ID paket publikasi tidak valid."),
  titleOrHook: z.string().optional(),
  captionText: z.string().optional(),
  hashtags: z.string().optional(),
  ctaText: z.string().optional(),
  checklist: z.record(z.string(), z.boolean()).optional(),
  scheduledAt: z.string().nullable().optional(),
  publishStatus: z
    .enum(["draft", "ready_for_manual_upload", "scheduled", "published"])
    .optional(),
  externalPostUrl: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get("contentId") || undefined;

    const items = await listContentItems(owner.ownerId);
    const selectedContent =
      (contentId ? items.find((i) => i.id === contentId) : items[0]) ?? null;

    if (!selectedContent) {
      return NextResponse.json({
        items: [],
        selectedContent: null,
        publications: [],
        finalVideoAsset: null,
      });
    }

    const [publications, assets] = await Promise.all([
      listOrInitializePublications(owner.ownerId, selectedContent.id),
      listAssetsForContent(owner.ownerId, selectedContent.id),
    ]);

    const finalVideoAsset =
      assets.find((a) => a.assetType === "final_video") ?? null;

    return NextResponse.json({
      items,
      selectedContent,
      publications,
      finalVideoAsset,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memuat paket publikasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = await resolveAuthenticatedOwner(request);
    const body = await request.json();
    const parsed = UpdatePublicationSchema.parse(body);

    const updated = await updatePlatformPublication(owner.ownerId, parsed);
    return NextResponse.json({ publication: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui paket publikasi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
