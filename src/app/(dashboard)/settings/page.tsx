import Link from "next/link";
import { Building2, ArrowRight, Gamepad2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsManager } from "@/features/settings/settings-manager";
import { TelegramSettingsCard } from "@/features/settings/telegram-settings-card";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getProjectSettings,
  getStorageBackendStatus,
} from "@/lib/db/repository";
import { getServerProviderStatuses } from "@/lib/config/env";
import { GOOGLE_APPS_SCRIPT_SNIPPET } from "@/features/content-library/google-sheets-sync";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const owner = await getAuthorizedOwner();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Studio &amp; Integrasi Cloud"
        subtitle="Kelola koneksi Telegram Bot, Google Drive, Spreadsheet, dan identitas channel CeritaObim."
        milestoneLabel="Setelan Proyek"
        statusLabel={
          storageStatus.mode === "supabase_postgres"
            ? "Database: Supabase Cloud"
            : "Database: Penyimpanan Lokal (.data)"
        }
      />

      {/* Akses Eksklusif Kantor Virtual 3D Obim Studio */}
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300 uppercase tracking-wider">
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>Simulasi 3D Interaktif</span>
            </div>
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              <span>Kantor Virtual 3D • CeritaObim Studio</span>
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Masuk ke dunia 3D Obim Studio untuk menjelajahi 11 meja Profil Chrome Produksi Video, Ruang Naskah &amp; Produser, Lounge Warkop Obim, serta Galeri Jadwal Tayang Buffer. Untuk kembali ke website studio dari dalam kantor virtual, cukup hampiri dan berinteraksi dengan <strong>Pintu Keluar Studio</strong>.
            </p>
          </div>

          <Link
            href="/virtual-office"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg transition transform hover:scale-[1.02] active:scale-95"
          >
            <span>🏢 Masuk ke Kantor Virtual 3D</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Pusat Kontrol Bot Telegram */}
      <TelegramSettingsCard />

      {/* Panduan Otomatisasi Google Drive & Spreadsheet */}
      <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
              Otomatisasi Google Drive + Spreadsheet
            </span>
            <h2 className="mt-1 text-base font-bold text-slate-900">
              Script Pembuat Folder Otomatis (`01_Produksi_Harian / Week_XX / Hari_XX_Judul`)
            </h2>
            <p className="text-xs text-slate-600">
              Pasang kode di bawah ini pada menu <strong>Extensions &rarr; Apps Script</strong> di dalam file Spreadsheet{" "}
              <code>ContentPlan_CeritaObim</code> Anda, lalu klik <strong>Deploy &rarr; New deployment (Web App, Anyone)</strong> dan masukkan URL-nya ke variabel <code>GOOGLE_SHEETS_WEBHOOK_URL</code> di Vercel / <code>.env.local</code>.
            </p>
          </div>
        </div>
        <details className="mt-3 rounded-xl border border-indigo-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-bold text-indigo-700">
            Lihat &amp; Copy Kode Google Apps Script (Auto-Update Sheet + Auto-Create Folder GDrive)
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {GOOGLE_APPS_SCRIPT_SNIPPET}
          </pre>
        </details>
      </section>

      <SettingsManager
        initialSettings={settings}
        initialStorageStatus={storageStatus}
        initialProviders={providers}
      />
    </div>
  );
}

