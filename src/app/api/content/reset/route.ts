import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createServerSupabaseAdminClient, getAuthorizedOwner } from "@/lib/auth/owner-auth";
import type { ContentItemRecord } from "@/types/domain";
import {
  commitApprovedBatchProposals,
  createAndGenerateWeeklyBatch,
  listContentBatches,
  listContentItems,
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

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
    const body = await request.json().catch(() => ({}));
    const shouldReseed = body.reseed !== false; // default true

    // 1. Fetch existing content to archive
    const existingItems = await listContentItems(owner.ownerId, { includeArchived: true });
    const existingBatches = await listContentBatches(owner.ownerId);

    // 2. Save backup archive on disk
    const archiveDir = path.join(process.cwd(), "storage", "archive");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(archiveDir, `backup_content_${timestamp}.json`);
    fs.writeFileSync(
      backupFile,
      JSON.stringify(
        {
          archivedAt: new Date().toISOString(),
          ownerId: owner.ownerId,
          totalItems: existingItems.length,
          totalBatches: existingBatches.length,
          items: existingItems,
          batches: existingBatches,
        },
        null,
        2
      ),
      "utf8"
    );

    // 3. Clear Supabase tables
    const supabase = createServerSupabaseAdminClient();
    if (supabase) {
      for (const item of existingItems) {
        try {
          await supabase.from("scenes").delete().eq("content_id", item.id);
          await supabase.from("assets").delete().eq("content_id", item.id);
        } catch {
          // ignore individual delete error
        }
      }
      await supabase.from("content_items").delete().eq("owner_id", owner.ownerId);
      await supabase.from("batches").delete().eq("owner_id", owner.ownerId);
    }

    // 4. Clear local mirror store
    const storePath = path.join(process.cwd(), ".data", "studio-store.json");
    if (fs.existsSync(storePath)) {
      try {
        const localStore = JSON.parse(fs.readFileSync(storePath, "utf8"));
        localStore.contentItems = [];
        localStore.batches = [];
        localStore.scenes = [];
        localStore.assets = [];
        localStore.jobs = [];
        fs.writeFileSync(storePath, JSON.stringify(localStore, null, 2), "utf8");
      } catch {
        // ignore parse error
      }
    }

    let reseededItems: ContentItemRecord[] = [];
    if (shouldReseed) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const batch = await createAndGenerateWeeklyBatch(owner.ownerId, {
        batchName: "Content Plan — Week 1",
        targetWeekStart: todayIso,
        targetVideoCount: 21,
        customThemeHint:
          "3 Program Harian CeritaObim: Ke Dapur Yuk! (kuliner/dapur), Kepikiran Aja (psikologi/relatable), Eh, Ternyata! (fakta tak terduga)",
      });

      const committed = await commitApprovedBatchProposals(owner.ownerId, batch.id, {
        commitAll: true,
        targetWeekNumber: 1,
      });

      reseededItems = committed.appendedItems;
    }

    return NextResponse.json({
      success: true,
      message: `Reset berhasil! ${existingItems.length} konten lama diarsipkan ke ${path.basename(backupFile)}. ${
        shouldReseed ? `21 konten baru Week 1 berhasil dibuat (3 program harian).` : "Database kini bersih."
      }`,
      backupFile: path.basename(backupFile),
      archivedCount: existingItems.length,
      createdCount: reseededItems.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Gagal melakukan reset: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      { status: 500 }
    );
  }
}
