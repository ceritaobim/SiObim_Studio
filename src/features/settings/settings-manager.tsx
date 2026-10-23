"use client";

import { useState, type FormEvent } from "react";
import {
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Lock,
  Palette,
  Sliders,
} from "lucide-react";
import type {
  PlatformTarget,
  ProjectSettingsSummary,
  ProviderStatusSummary,
  StorageBackendStatus,
} from "@/types/domain";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface SettingsManagerProps {
  initialSettings: ProjectSettingsSummary;
  initialStorageStatus: StorageBackendStatus;
  initialProviders: ProviderStatusSummary[];
}

export function SettingsManager({
  initialSettings,
  initialStorageStatus,
  initialProviders,
}: SettingsManagerProps) {
  const [form, setForm] = useState<ProjectSettingsSummary>(initialSettings);
  const [storageStatus, setStorageStatus] =
    useState<StorageBackendStatus>(initialStorageStatus);
  const [providers, setProviders] =
    useState<ProviderStatusSummary[]>(initialProviders);
  const [saving, setSaving] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const togglePlatform = (platform: PlatformTarget) => {
    setForm((prev) => {
      const exists = prev.targetPlatforms.includes(platform);
      if (exists && prev.targetPlatforms.length === 1) {
        return prev; // Keep at least one platform
      }
      return {
        ...prev,
        targetPlatforms: exists
          ? prev.targetPlatforms.filter((p) => p !== platform)
          : [...prev.targetPlatforms, platform],
      };
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.issues)
          ? ` (${data.issues.join(", ")})`
          : "";
        throw new Error((data.error || "Gagal menyimpan pengaturan") + detail);
      }
      setForm(data.settings);
      setFeedback({
        type: "success",
        text: "Pengaturan proyek berhasil disimpan dan akan otomatis dipakai pada setiap batch mingguan.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menyimpan pengaturan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memeriksa status koneksi.");
      }
      setStorageStatus(data.storageStatus);
      setProviders(data.providers);
      setFeedback({
        type: "success",
        text: data.storageStatus.message,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal melakukan uji koneksi.",
      });
    } finally {
      setTestingConn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage & Migration Banner */}
      <div
        className={`rounded-xl border p-4 text-xs sm:text-sm ${
          storageStatus.supabaseTableReady
            ? "border-emerald-200 bg-emerald-50/80 text-emerald-950"
            : "border-amber-200 bg-amber-50/80 text-amber-950"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Database className="h-5 w-5 shrink-0 mt-0.5 text-amber-700" />
            <div>
              <p className="font-semibold">
                Mode Penyimpanan Aktif:{" "}
                {storageStatus.mode === "supabase_postgres"
                  ? "Supabase PostgreSQL"
                  : "Penyimpanan Persisten Lokal (.data/studio-store.json)"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                {storageStatus.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConn}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${testingConn ? "animate-spin" : ""}`}
            />
            <span>{testingConn ? "Memeriksa..." : "Uji Koneksi Database"}</span>
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <SectionCard
            title="1. Identitas Channel & Jadwal"
            description="Konfigurasi sekali pakai untuk seluruh batch mingguan."
            badge={<StatusBadge label="Persisten" variant="info" />}
          >
            <div className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="projectName"
                    className="block font-medium text-stone-700"
                  >
                    Nama Proyek
                  </label>
                  <input
                    id="projectName"
                    type="text"
                    required
                    value={form.projectName}
                    onChange={(e) =>
                      setForm({ ...form, projectName: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="channelName"
                    className="block font-medium text-stone-700"
                  >
                    Username Channel
                  </label>
                  <input
                    id="channelName"
                    type="text"
                    required
                    value={form.channelName}
                    onChange={(e) =>
                      setForm({ ...form, channelName: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="language"
                    className="block font-medium text-stone-700"
                  >
                    Bahasa Utama
                  </label>
                  <input
                    id="language"
                    type="text"
                    required
                    value={form.language}
                    onChange={(e) =>
                      setForm({ ...form, language: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="timezone"
                    className="block font-medium text-stone-700"
                  >
                    Zona Waktu
                  </label>
                  <input
                    id="timezone"
                    type="text"
                    required
                    value={form.timezone}
                    onChange={(e) =>
                      setForm({ ...form, timezone: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="niche"
                  className="block font-medium text-stone-700"
                >
                  Niche & Topik Utama
                </label>
                <input
                  id="niche"
                  type="text"
                  required
                  value={form.niche}
                  onChange={(e) => setForm({ ...form, niche: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="toneGuide"
                  className="block font-medium text-stone-700"
                >
                  Panduan Gaya Bahasa (Tone of Voice)
                </label>
                <textarea
                  id="toneGuide"
                  rows={2}
                  required
                  value={form.toneGuide}
                  onChange={(e) =>
                    setForm({ ...form, toneGuide: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <span className="block font-medium text-stone-700 mb-1.5">
                  Target Platform Publikasi
                </span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "tiktok", label: "TikTok" },
                      { key: "youtube", label: "YouTube Shorts" },
                      { key: "instagram", label: "Instagram Reels" },
                    ] as const
                  ).map((p) => {
                    const active = form.targetPlatforms.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePlatform(p.key)}
                        aria-pressed={active}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "border-amber-600 bg-amber-50 text-amber-900"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {active ? "✓ " : ""}
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="2. Identitas Visual Origami & Durasi"
            description="Digunakan secara otomatis saat membangun prompt scene."
            badge={<StatusBadge label="9:16 • Tanpa Subtitle" variant="success" />}
          >
            <div className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label
                  htmlFor="visualStyleGuide"
                  className="flex items-center gap-1.5 font-medium text-stone-700"
                >
                  <Palette className="h-4 w-4 text-amber-600" />
                  <span>Panduan Visual Wajib (Origami Paper Stop-Motion)</span>
                </label>
                <textarea
                  id="visualStyleGuide"
                  rows={3}
                  required
                  value={form.visualStyleGuide}
                  onChange={(e) =>
                    setForm({ ...form, visualStyleGuide: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="characterDescription"
                  className="block font-medium text-stone-700"
                >
                  Deskripsi Karakter Utama (Konsistensi Antar Scene)
                </label>
                <textarea
                  id="characterDescription"
                  rows={2}
                  required
                  value={form.characterDescription}
                  onChange={(e) =>
                    setForm({ ...form, characterDescription: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label
                    htmlFor="defaultDurationSeconds"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Durasi Default (dtk)
                  </label>
                  <input
                    id="defaultDurationSeconds"
                    type="number"
                    min={15}
                    max={180}
                    required
                    value={form.defaultDurationSeconds}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        defaultDurationSeconds: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="targetSceneSecondsMin"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Scene Min (dtk)
                  </label>
                  <input
                    id="targetSceneSecondsMin"
                    type="number"
                    min={3}
                    max={20}
                    required
                    value={form.targetSceneSecondsMin}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetSceneSecondsMin: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="targetSceneSecondsMax"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Scene Maks (dtk)
                  </label>
                  <input
                    id="targetSceneSecondsMax"
                    type="number"
                    min={4}
                    max={30}
                    required
                    value={form.targetSceneSecondsMax}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        targetSceneSecondsMax: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor="weeklyVideoTarget"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Target Video/Minggu
                  </label>
                  <input
                    id="weeklyVideoTarget"
                    type="number"
                    min={1}
                    max={21}
                    required
                    value={form.weeklyVideoTarget}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        weeklyVideoTarget: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dailyBudgetLimit"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Cap Harian (USD)
                  </label>
                  <input
                    id="dailyBudgetLimit"
                    type="number"
                    step="0.5"
                    min={0}
                    required
                    value={form.dailyBudgetLimit}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        dailyBudgetLimit: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="monthlyBudgetLimit"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Cap Bulanan (USD)
                  </label>
                  <input
                    id="monthlyBudgetLimit"
                    type="number"
                    step="1"
                    min={0}
                    required
                    value={form.monthlyBudgetLimit}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        monthlyBudgetLimit: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="maxSceneRetries"
                    className="block text-xs font-medium text-stone-700"
                  >
                    Maks Retry
                  </label>
                  <input
                    id="maxSceneRetries"
                    type="number"
                    min={0}
                    max={5}
                    required
                    value={form.maxSceneRetries}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        maxSceneRetries: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-stone-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5 text-stone-700">
                  <Sliders className="h-3.5 w-3.5 text-amber-600" />
                  <span>Mode Produksi Klip Video:</span>
                </span>
                <span className="font-semibold text-stone-900">
                  Semi-Manual Google Flow (MVP)
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 sm:text-sm"
          >
            <Save className="h-4 w-4" />
            <span>
              {saving ? "Menyimpan..." : "Simpan Pengaturan Proyek"}
            </span>
          </button>
        </div>
      </form>

      <SectionCard
        title="3. Status Konfigurasi Provider (Server-Side)"
        description="Kunci rahasia dibaca di server dan tidak pernah terekspos ke browser."
        badge={<StatusBadge label="Zero Secret Leak" variant="success" />}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {providers.map((provider) => (
            <div
              key={provider.key}
              className="rounded-lg border border-stone-200 p-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-stone-900">
                  {provider.displayName}
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge
                    label={
                      provider.configuredInEnv ? "Env Terdeteksi" : "Env Kosong"
                    }
                    variant={provider.configuredInEnv ? "info" : "neutral"}
                  />
                  <StatusBadge
                    label={provider.connected ? "Terhubung" : "Fallback / Siap"}
                    variant={provider.connected ? "success" : "warning"}
                  />
                </div>
              </div>
              <p className="mt-1 font-medium text-stone-700">
                {provider.modeLabel}
              </p>
              <p className="mt-0.5 text-stone-500">{provider.notes}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
          <Lock className="h-4 w-4 shrink-0 text-stone-500 mt-0.5" />
          <p>
            Untuk mengaktifkan tabel di Supabase Cloud Anda, buka dashboard Supabase{" "}
            <strong>SQL Editor</strong> lalu jalankan isi file{" "}
            <code className="font-mono text-stone-800">
              supabase/migrations/0001_initial_schema.sql
            </code>{" "}
            dan opsional{" "}
            <code className="font-mono text-stone-800">supabase/seed.sql</code>,
            kemudian klik <strong>Uji Koneksi Database</strong> di atas.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
