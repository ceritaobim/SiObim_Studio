import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getProjectSettings,
  getStorageBackendStatus,
  saveProjectSettings,
} from "@/lib/db/repository";
import { ProjectSettingsInputSchema } from "@/lib/validation/schemas";
import { getServerProviderStatuses } from "@/lib/config/env";

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

  const [settings, storageStatus] = await Promise.all([
    getProjectSettings(owner.ownerId),
    getStorageBackendStatus(),
  ]);

  const providers = getServerProviderStatuses().map((p) =>
    p.key === "supabase"
      ? {
          ...p,
          connected: storageStatus.supabaseTableReady,
          modeLabel:
            storageStatus.mode === "supabase_postgres"
              ? "Terhubung ke Supabase PostgreSQL"
              : storageStatus.supabaseConfigured
              ? "Supabase Terdeteksi (Menunggu Migrasi SQL -> Fallback Lokal Aktif)"
              : "Mode Penyimpanan Lokal (.data/studio-store.json)",
        }
      : p
  );

  return NextResponse.json({
    settings,
    storageStatus,
    providers,
  });
}

export async function PUT(request: Request) {
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
    const parsed = ProjectSettingsInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR: Data pengaturan tidak valid.",
          issues: parsed.error.issues.map(
            (i) => `${i.path.join(".")}: ${i.message}`
          ),
        },
        { status: 400 }
      );
    }

    const updated = await saveProjectSettings(owner.ownerId, parsed.data);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan pengaturan proyek.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
