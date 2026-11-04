import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  createContentItem,
  getStorageBackendStatus,
  listContentItems,
  updateContentItem,
} from "@/lib/db/repository";
import {
  ContentItemInputSchema,
  ContentItemUpdateSchema,
} from "@/lib/validation/schemas";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";
import { runAutopilotCycle } from "@/lib/services/autopilot-orchestrator";

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

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  const [items, storageStatus] = await Promise.all([
    listContentItems(owner.ownerId, { includeArchived }),
    getStorageBackendStatus(),
  ]);

  return NextResponse.json({
    items,
    storageStatus,
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
    const parsed = ContentItemInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR: Data konten tidak valid.",
          issues: parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        },
        { status: 400 }
      );
    }

    const existingItems = await listContentItems(owner.ownerId, {
      includeArchived: true,
    });
    const duplicateWarnings = findDuplicateTopicWarnings(
      {
        title: parsed.data.title,
        topic: parsed.data.topic,
        excludeCode: parsed.data.contentCode,
      },
      existingItems
    );

    const created = await createContentItem(owner.ownerId, parsed.data);

    // Auto-trigger Fase 2: Generate TTS voice, alignment timestamps & visual scene prompts asynchronously
    runAutopilotCycle(owner.ownerId).catch((err) => {
      console.warn("Background auto-voice trigger warning:", err);
    });

    return NextResponse.json(
      {
        item: created,
        duplicateWarnings,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal membuat konten baru.";
    const status = message.includes("DUPLICATE_CONTENT_CODE") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
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
    const parsed = ContentItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR: Pembaruan konten tidak valid.",
          issues: parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        },
        { status: 400 }
      );
    }

    const updated = await updateContentItem(owner.ownerId, parsed.data);
    return NextResponse.json({ item: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal memperbarui konten.";
    const status = message.includes("FORBIDDEN")
      ? 403
      : message.includes("NOT_FOUND")
      ? 404
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
