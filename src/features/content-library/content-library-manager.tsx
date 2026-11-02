"use client";

import { useState, useMemo, type FormEvent } from "react";
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Archive,
  ExternalLink,
  X,
  CloudDownload,
  CloudUpload,
  Copy,
} from "lucide-react";
import type {
  ContentItemRecord,
  ContentStatus,
  DuplicateTopicWarning,
  ObimProgramName,
  StorageBackendStatus,
  VerificationStatus,
} from "@/types/domain";
import type { ImportPreviewReport } from "@/features/content-library/xlsx-service";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";
import { GOOGLE_APPS_SCRIPT_SNIPPET } from "@/features/content-library/google-sheets-sync";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface ContentLibraryManagerProps {
  initialItems: ContentItemRecord[];
  initialStorageStatus: StorageBackendStatus;
  initialGoogleSheetUrl?: string;
  initialGoogleSheetWebAppUrl?: string;
}

const CONTENT_STATUS_OPTIONS: ContentStatus[] = [
  "idea",
  "planned",
  "script_approved",
  "in_production",
  "assembled",
  "approved",
  "ready_to_publish",
  "published",
  "archived",
];

const VERIFICATION_STATUS_OPTIONS: VerificationStatus[] = [
  "draft",
  "needs_verification",
  "verified",
  "rejected",
];

export function ContentLibraryManager({
  initialItems,
  initialStorageStatus,
  initialGoogleSheetUrl = "",
  initialGoogleSheetWebAppUrl = "",
}: ContentLibraryManagerProps) {
  const [items, setItems] = useState<ContentItemRecord[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<string>("all");
  const [programFilter, setProgramFilter] = useState<string>("all");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState(() => {
    const nextNum = String(initialItems.length + 1).padStart(3, "0");
    return `CO-2026-${nextNum}`;
  });
  const [newProgramName, setNewProgramName] =
    useState<ObimProgramName>("Ke Dapur Yuk!");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Kuliner & Makanan");
  const [newTopic, setNewTopic] = useState("");
  const [newHook, setNewHook] = useState("");
  const [newNarration, setNewNarration] = useState("");
  const [newDuration, setNewDuration] = useState(28);
  const [newClaimsText, setNewClaimsText] = useState("");
  const [newSourceUrlsText, setNewSourceUrlsText] = useState("");

  // Import state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<ImportPreviewReport | null>(
    null
  );
  const [importing, setImporting] = useState(false);

  // Google Sheets Sync state
  const [showGSheetsPanel, setShowGSheetsPanel] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState(initialGoogleSheetUrl);
  const [googleSheetWebAppUrl, setGoogleSheetWebAppUrl] = useState(
    initialGoogleSheetWebAppUrl
  );
  const [gsheetReport, setGsheetReport] = useState<ImportPreviewReport | null>(
    null
  );
  const [syncingGSheets, setSyncingGSheets] = useState(false);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Live duplicate topic warnings while typing a new content item
  const liveDuplicateWarnings: DuplicateTopicWarning[] = useMemo(() => {
    if (newTitle.trim().length < 4 && newTopic.trim().length < 4) return [];
    return findDuplicateTopicWarnings(
      {
        title: newTitle,
        topic: newTopic,
        excludeCode: newCode,
      },
      items
    );
  }, [newTitle, newTopic, newCode, items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== "all" && item.contentStatus !== statusFilter) {
        return false;
      }
      if (
        verificationFilter !== "all" &&
        item.verificationStatus !== verificationFilter
      ) {
        return false;
      }
      if (programFilter !== "all" && item.programName !== programFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.contentCode.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, statusFilter, verificationFilter, programFilter]);

  const handleCreateContent = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);

    try {
      const claims = newClaimsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const urls = newSourceUrlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentCode: newCode.trim().toUpperCase(),
          programName: newProgramName,
          title: newTitle.trim(),
          category: newCategory.trim(),
          topic: newTopic.trim(),
          hook: newHook.trim(),
          narration: newNarration.trim(),
          targetDurationSeconds: Number(newDuration) || 28,
          factualClaims: claims,
          sourceUrls: urls,
          verificationStatus:
            urls.length > 0 ? "verified" : "needs_verification",
          contentStatus: "idea",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.issues)
          ? ` (${data.issues.join(" • ")})`
          : "";
        throw new Error(
          (data.error || "Gagal menambahkan konten baru.") + detail
        );
      }

      const updatedList = [...items, data.item as ContentItemRecord].sort(
        (a, b) => a.contentCode.localeCompare(b.contentCode)
      );
      setItems(updatedList);
      setShowCreateForm(false);
      setNewTitle("");
      setNewTopic("");
      setNewHook("");
      setNewNarration("");
      setNewClaimsText("");
      setNewSourceUrlsText("");
      setNewCode(
        `CO-2026-${String(updatedList.length + 1).padStart(3, "0")}`
      );

      const dupCount = Array.isArray(data.duplicateWarnings)
        ? data.duplicateWarnings.length
        : 0;
      setFeedback({
        type: dupCount > 0 ? "warning" : "success",
        text:
          dupCount > 0
            ? `Konten ${data.item.contentCode} berhasil disimpan (dengan ${dupCount} peringatan kemiripan topik untuk ditinjau).`
            : `Konten ${data.item.contentCode} berhasil ditambahkan ke pustaka.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menyimpan konten.",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleQuickStatusUpdate = async (
    id: string,
    patch: {
      contentStatus?: ContentStatus;
      verificationStatus?: VerificationStatus;
    }
  ) => {
    setFeedback(null);
    try {
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui status konten.");
      }
      setItems((prev) =>
        prev
          .map((item) =>
            item.id === id ? (data.item as ContentItemRecord) : item
          )
          .filter((item) => item.contentStatus !== "archived")
      );
      setFeedback({
        type: "success",
        text: `Status konten ${data.item.contentCode} berhasil diperbarui.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui status konten.",
      });
    }
  };

  const handleImportAction = async (mode: "preview" | "commit") => {
    if (!selectedFile) return;
    setImporting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("mode", mode);

      const res = await fetch("/api/content/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses file XLSX.");
      }

      setImportReport(data.report);
      if (mode === "commit") {
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
        setFeedback({
          type: "success",
          text: `Impor selesai: ${data.commitResult.insertedCount} baris baru berhasil ditambahkan. Tidak ada konten lama yang ditimpa.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengimpor file.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleGoogleSheetsAction = async (
    action: "pull_preview" | "pull_commit" | "push_all"
  ) => {
    setSyncingGSheets(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/content/gsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          googleSheetUrl,
          googleSheetWebAppUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Gagal melakukan sinkronisasi Google Spreadsheet."
        );
      }

      if (action === "push_all") {
        setFeedback({
          type: "success",
          text:
            data.message ||
            "Berhasil mengirim konten ke Google Spreadsheet Anda.",
        });
        return;
      }

      setGsheetReport(data.report);
      if (action === "pull_commit") {
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
        setFeedback({
          type: "success",
          text: `Tarik dari Google Sheets selesai: ${data.commitResult.insertedCount} baris baru berhasil ditambahkan ke Content Library.`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal melakukan sinkronisasi Google Spreadsheet.",
      });
    } finally {
      setSyncingGSheets(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge
            label={
              initialStorageStatus.mode === "supabase_postgres"
                ? "DB: Supabase PostgreSQL"
                : "DB: Lokal Persisten (.data)"
            }
            variant={
              initialStorageStatus.mode === "supabase_postgres"
                ? "success"
                : "info"
            }
          />
          <span className="text-stone-600">
            Total Konten Aktif: <strong>{items.length}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm((v) => !v);
              setShowImportPanel(false);
              setShowGSheetsPanel(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Konten</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowGSheetsPanel((v) => !v);
              setShowCreateForm(false);
              setShowImportPanel(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            <CloudDownload className="h-4 w-4 text-emerald-700" />
            <span>Sync Google Sheets (GDrive)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowImportPanel((v) => !v);
              setShowCreateForm(false);
              setShowGSheetsPanel(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-600" />
            <span>Impor File XLSX</span>
          </button>

          <a
            href="/api/content/export"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            <span>Ekspor XLSX</span>
          </a>
        </div>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`flex items-start justify-between gap-2 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : feedback.type === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className="text-stone-500 hover:text-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Google Sheets (GDrive) Sync Panel */}
      {showGSheetsPanel ? (
        <SectionCard
          title="Sinkronisasi Google Spreadsheet (Google Drive)"
          description="Tarik langsung isi spreadsheet perencanaan Anda dari Google Drive atau kirim (append) baris baru ke Google Sheet tanpa menimpa baris lama."
          badge={<StatusBadge label="2-Way GSheets Sync" variant="success" />}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                <label className="block font-semibold text-stone-800">
                  1. Tarik Data dari Google Sheets (Pull)
                </label>
                <p className="text-stone-600">
                  Tempel link Google Spreadsheet Anda (pastikan akses Share disetel ke{" "}
                  <strong>Anyone with the link can view</strong>):
                </p>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/xxxx/edit"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!googleSheetUrl.trim() || syncingGSheets}
                    onClick={() => handleGoogleSheetsAction("pull_preview")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                  >
                    <CloudDownload className="h-3.5 w-3.5 text-emerald-700" />
                    <span>Periksa Isi GSheets (Preview)</span>
                  </button>
                  {gsheetReport && gsheetReport.validNewCount > 0 ? (
                    <button
                      type="button"
                      disabled={syncingGSheets}
                      onClick={() => handleGoogleSheetsAction("pull_commit")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <span>
                        Simpan {gsheetReport.validNewCount} Baris Baru ke Studio
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                <label className="block font-semibold text-stone-800">
                  2. Kirim Otomatis ke Google Sheets (Push / Append)
                </label>
                <p className="text-stone-600">
                  Tempelkan <strong>Apps Script Web App URL</strong> dari Google Sheet Anda agar konten baru otomatis tertulis ke GDrive:
                </p>
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/xxxx/exec"
                  value={googleSheetWebAppUrl}
                  onChange={(e) => setGoogleSheetWebAppUrl(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!googleSheetWebAppUrl.trim() || syncingGSheets}
                    onClick={() => handleGoogleSheetsAction("push_all")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    <span>Kirim Semua Konten Baru ke GSheets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAppsScriptGuide((v) => !v)}
                    className="text-amber-700 underline hover:text-amber-900 font-medium"
                  >
                    {showAppsScriptGuide
                      ? "Sembunyikan Cara Pasang"
                      : "Lihat Cara Pasang 1 Menit"}
                  </button>
                </div>
              </div>
            </div>

            {showAppsScriptGuide ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-amber-950">
                    Cara Menghubungkan Tulis Otomatis ke Google Sheets Anda (Tanpa Kredensial Rumit):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SNIPPET);
                      setFeedback({
                        type: "success",
                        text: "Kode Google Apps Script berhasil disalin ke clipboard!",
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Kode Script</span>
                  </button>
                </div>
                <ol className="list-decimal pl-5 text-amber-900 space-y-1">
                  <li>
                    Buka file Google Spreadsheet Anda di Google Drive, lalu klik menu{" "}
                    <strong>Extensions &rarr; Apps Script</strong>.
                  </li>
                  <li>
                    Hapus kode kosong di dalamnya, lalu tempel kode di bawah ini dan klik ikon Simpan.
                  </li>
                  <li>
                    Klik tombol biru <strong>Deploy &rarr; New deployment</strong>, pilih tipe{" "}
                    <strong>Web app</strong>, setel <em>Who has access</em> ke{" "}
                    <strong>Anyone</strong>, lalu klik <strong>Deploy</strong>.
                  </li>
                  <li>
                    Salin <strong>Web app URL</strong> yang muncul lalu tempel ke kotak nomor 2 di atas.
                  </li>
                </ol>
                <pre className="max-h-40 overflow-x-auto rounded bg-stone-900 p-2.5 text-[11px] text-stone-100">
                  {GOOGLE_APPS_SCRIPT_SNIPPET}
                </pre>
              </div>
            ) : null}

            {gsheetReport ? (
              <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={`Baris Baru Valid: ${gsheetReport.validNewCount}`}
                    variant="success"
                  />
                  <StatusBadge
                    label={`Konflik ID (Dilewati): ${gsheetReport.conflictCodeCount}`}
                    variant="warning"
                  />
                  <StatusBadge
                    label={`Error Validasi: ${gsheetReport.invalidRowCount}`}
                    variant="danger"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {/* Create Content Panel */}
      {showCreateForm ? (
        <SectionCard
          title="Tambah Ide / Konten Baru"
          description="Sistem otomatis memeriksa kemiripan topik terhadap pustaka konten yang sudah ada."
          badge={<StatusBadge label="Append-Only" variant="info" />}
        >
          <form onSubmit={handleCreateContent} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="newCode"
                  className="block font-medium text-stone-700"
                >
                  Content ID (Unik)
                </label>
                <input
                  id="newCode"
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-stone-900"
                />
              </div>
              <div>
                <label
                  htmlFor="newProgramName"
                  className="block font-medium text-stone-700"
                >
                  Program Resmi
                </label>
                <select
                  id="newProgramName"
                  value={newProgramName}
                  onChange={(e) =>
                    setNewProgramName(e.target.value as ObimProgramName)
                  }
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
                >
                  <option value="Ke Dapur Yuk!">🍳 Ke Dapur Yuk!</option>
                  <option value="Kepikiran Aja">🌙 Kepikiran Aja</option>
                  <option value="Eh, Ternyata!">💡 Eh, Ternyata!</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="newCategory"
                  className="block font-medium text-stone-700"
                >
                  Kategori
                </label>
                <input
                  id="newCategory"
                  type="text"
                  required
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
              <div>
                <label
                  htmlFor="newDuration"
                  className="block font-medium text-stone-700"
                >
                  Target Durasi (detik)
                </label>
                <input
                  id="newDuration"
                  type="number"
                  min={15}
                  max={60}
                  required
                  value={newDuration}
                  onChange={(e) => setNewDuration(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="newTitle"
                  className="block font-medium text-stone-700"
                >
                  Judul Konten (Minimal 3 Karakter)
                </label>
                <input
                  id="newTitle"
                  type="text"
                  minLength={3}
                  required
                  placeholder="Contoh: Mengapa Air Laut Terasa Asin?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
              <div>
                <label
                  htmlFor="newTopic"
                  className="block font-medium text-stone-700"
                >
                  Topik / Sudut Pandang Utama (Minimal 3 Karakter)
                </label>
                <input
                  id="newTopic"
                  type="text"
                  minLength={3}
                  required
                  placeholder="Proses mineral batuan daratan terbawa sungai ke samudra"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
            </div>

            {liveDuplicateWarnings.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                  <span>
                    Peringatan Kemiripan Topik ({liveDuplicateWarnings.length}{" "}
                    konten serupa ditemukan):
                  </span>
                </p>
                <ul className="mt-1.5 space-y-1 pl-5 list-disc">
                  {liveDuplicateWarnings.map((w) => (
                    <li key={w.existingCode}>
                      <strong>{w.existingCode}:</strong> {w.existingTitle} —{" "}
                      <span className="text-amber-800">{w.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="newHook"
                  className="block font-medium text-stone-700"
                >
                  Kalimat Pembuka (Hook 3 Detik Pertama)
                </label>
                <textarea
                  id="newHook"
                  rows={2}
                  value={newHook}
                  onChange={(e) => setNewHook(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
              <div>
                <label
                  htmlFor="newNarration"
                  className="block font-medium text-stone-700"
                >
                  Draf Narasi Lengkap (Bahasa Indonesia)
                </label>
                <textarea
                  id="newNarration"
                  rows={2}
                  value={newNarration}
                  onChange={(e) => setNewNarration(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="newClaimsText"
                  className="block font-medium text-stone-700"
                >
                  Klaim Fakta (Satu klaim per baris)
                </label>
                <textarea
                  id="newClaimsText"
                  rows={2}
                  placeholder="Air hujan yang sedikit asam mengikis mineral garam dari batuan..."
                  value={newClaimsText}
                  onChange={(e) => setNewClaimsText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
              </div>
              <div>
                <label
                  htmlFor="newSourceUrlsText"
                  className="block font-medium text-stone-700"
                >
                  URL Sumber Referensi (Satu URL per baris)
                </label>
                <textarea
                  id="newSourceUrlsText"
                  rows={2}
                  placeholder="https://oceanservice.noaa.gov/facts/whysalty.html"
                  value={newSourceUrlsText}
                  onChange={(e) => setNewSourceUrlsText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Jika dikosongkan, status verifikasi otomatis menjadi{" "}
                  <code>needs_verification</code>.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-medium text-stone-700 hover:bg-stone-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {creating ? "Menyimpan..." : "Simpan ke Pustaka"}
              </button>
            </div>
          </form>
        </SectionCard>
      ) : null}

      {/* XLSX Import Panel */}
      {showImportPanel ? (
        <SectionCard
          title="Impor Spreadsheet Content Plan (.xlsx / .csv)"
          description="Periksa pratinjau error, konflik Content ID, dan kemiripan topik sebelum menyimpan ke database."
          badge={<StatusBadge label="Non-Destructive Import" variant="success" />}
        >
          <div className="space-y-4 text-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label="Pilih file spreadsheet untuk diimpor"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  setImportReport(null);
                }}
                className="block w-full text-xs text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-900 hover:file:bg-amber-100"
              />
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={!selectedFile || importing}
                  onClick={() => handleImportAction("preview")}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                >
                  {importing ? "Memeriksa..." : "1. Periksa File (Preview)"}
                </button>
                {importReport && importReport.validNewCount > 0 ? (
                  <button
                    type="button"
                    disabled={importing}
                    onClick={() => handleImportAction("commit")}
                    className="rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    2. Simpan {importReport.validNewCount} Baris Baru
                  </button>
                ) : null}
              </div>
            </div>

            {importReport ? (
              <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={`Baris Baru Valid: ${importReport.validNewCount}`}
                    variant="success"
                  />
                  <StatusBadge
                    label={`Konflik ID (Dilewati): ${importReport.conflictCodeCount}`}
                    variant={
                      importReport.conflictCodeCount > 0 ? "warning" : "neutral"
                    }
                  />
                  <StatusBadge
                    label={`Error Validasi: ${importReport.invalidRowCount}`}
                    variant={
                      importReport.invalidRowCount > 0 ? "danger" : "neutral"
                    }
                  />
                  <StatusBadge
                    label={`Placeholder Dilewati: ${importReport.skippedPlaceholderCount}`}
                    variant="neutral"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {importReport.rows.map((r) => (
                    <div
                      key={r.rowNumber}
                      className="rounded border border-stone-200 bg-white p-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-stone-800">
                          Baris #{r.rowNumber}{" "}
                          {r.item
                            ? `• ${r.item.contentCode} — ${r.item.title}`
                            : ""}
                        </span>
                        <StatusBadge
                          label={r.status}
                          variant={
                            r.status === "valid_new"
                              ? "success"
                              : r.status === "conflict_existing_code"
                              ? "warning"
                              : r.status === "placeholder_skipped"
                              ? "neutral"
                              : "danger"
                          }
                        />
                      </div>
                      {r.errors.length > 0 ? (
                        <p className="mt-1 text-rose-700">
                          {r.errors.join("; ")}
                        </p>
                      ) : null}
                      {r.duplicateTopicWarnings.length > 0 ? (
                        <p className="mt-1 text-amber-800">
                          ⚠️ Mirip dengan:{" "}
                          {r.duplicateTopicWarnings
                            .map((w) => `${w.existingCode} (${w.reason})`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {/* Program Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-stone-600">Filter Program:</span>
        <button
          type="button"
          onClick={() => setProgramFilter("all")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            programFilter === "all"
              ? "border-stone-800 bg-stone-900 text-white shadow-xs"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          Semua Program ({items.length})
        </button>
        <button
          type="button"
          onClick={() => setProgramFilter("Ke Dapur Yuk!")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            programFilter === "Ke Dapur Yuk!"
              ? "border-amber-600 bg-amber-600 text-white shadow-xs"
              : "border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-100"
          }`}
        >
          🍳 Ke Dapur Yuk! (
          {items.filter((i) => i.programName === "Ke Dapur Yuk!").length})
        </button>
        <button
          type="button"
          onClick={() => setProgramFilter("Kepikiran Aja")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            programFilter === "Kepikiran Aja"
              ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
              : "border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100"
          }`}
        >
          🌙 Kepikiran Aja (
          {items.filter((i) => i.programName === "Kepikiran Aja").length})
        </button>
        <button
          type="button"
          onClick={() => setProgramFilter("Eh, Ternyata!")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            programFilter === "Eh, Ternyata!"
              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
              : "border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100"
          }`}
        >
          💡 Eh, Ternyata! (
          {items.filter((i) => i.programName === "Eh, Ternyata!").length})
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-3.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-stone-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kode (CO-2026-001), judul, kategori, atau topik..."
            aria-label="Cari pustaka konten"
            className="w-full rounded-lg border border-stone-200 bg-stone-50 py-2 pr-3 pl-9 text-xs text-stone-900 focus:border-amber-600 focus:bg-white focus:outline-none sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Filter status produksi"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-stone-800"
          >
            <option value="all">Semua Status Produksi</option>
            {CONTENT_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                Status: {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter status verifikasi fakta"
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-stone-800"
          >
            <option value="all">Semua Verifikasi Fakta</option>
            {VERIFICATION_STATUS_OPTIONS.map((vf) => (
              <option key={vf} value={vf}>
                Verifikasi: {vf}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Cards List (360px Mobile & Desktop Friendly) */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500 sm:text-sm">
            Tidak ada konten yang cocok dengan pencarian/filter saat ini.
          </div>
        ) : (
          filteredItems.map((item) => {
            const overlaps = findDuplicateTopicWarnings(
              {
                title: item.title,
                topic: item.topic,
                excludeId: item.id,
                excludeCode: item.contentCode,
              },
              items
            );

            return (
              <article
                key={item.id}
                className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                      {item.contentCode}
                    </span>
                    {item.programName && (
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                          item.programName === "Ke Dapur Yuk!"
                            ? "border-amber-300 bg-amber-100 text-amber-900"
                            : item.programName === "Kepikiran Aja"
                            ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                            : "border-emerald-300 bg-emerald-100 text-emerald-900"
                        }`}
                      >
                        {item.programName === "Ke Dapur Yuk!"
                          ? "🍳 "
                          : item.programName === "Kepikiran Aja"
                          ? "🌙 "
                          : "💡 "}
                        {item.programName}
                      </span>
                    )}
                    {item.isDemo ? (
                      <StatusBadge
                        label="DATA CONTOH / DEMO"
                        variant="warning"
                      />
                    ) : null}
                    <span className="text-xs text-stone-500">
                      {item.category} • Target {item.targetDurationSeconds} dtk
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge
                      label={`Verifikasi: ${item.verificationStatus}`}
                      variant={
                        item.verificationStatus === "verified"
                          ? "success"
                          : item.verificationStatus === "rejected"
                          ? "danger"
                          : "warning"
                      }
                    />
                    <StatusBadge
                      label={`Status: ${item.contentStatus}`}
                      variant="info"
                    />
                  </div>
                </div>

                <h3 className="mt-2 text-sm font-bold text-stone-900 sm:text-base">
                  {item.title}
                </h3>
                <p className="mt-0.5 text-xs text-stone-600">
                  <strong>Topik:</strong> {item.topic}
                </p>

                {item.hook ? (
                  <p className="mt-2 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-700 italic">
                    &ldquo;{item.hook}&rdquo;
                  </p>
                ) : null}

                {item.narration ? (
                  <p className="mt-2 text-xs text-stone-700 leading-relaxed line-clamp-3">
                    {item.narration}
                  </p>
                ) : null}

                {overlaps.length > 0 ? (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                    <div>
                      <span className="font-semibold">
                        Peringatan Topik Serupa:{" "}
                      </span>
                      {overlaps
                        .map((o) => `${o.existingCode} (${o.reason})`)
                        .join(" • ")}
                    </div>
                  </div>
                ) : null}

                {/* Claims & Sources */}
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-stone-100 pt-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="font-semibold text-stone-700">
                      Klaim Fakta ({item.factualClaims.length}):
                    </span>
                    {item.factualClaims.length > 0 ? (
                      <ul className="mt-1 list-disc pl-4 text-stone-600 space-y-0.5">
                        {item.factualClaims.map((claim, i) => (
                          <li key={i}>{claim}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-stone-400">
                        Belum ada klaim tercatat
                      </p>
                    )}
                  </div>

                  <div>
                    <span className="font-semibold text-stone-700">
                      Sumber Referensi ({item.sourceUrls.length}):
                    </span>
                    {item.sourceUrls.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {item.sourceUrls.map((url, i) => (
                          <li key={i}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-amber-700 underline hover:text-amber-900 break-all"
                            >
                              <span>{url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-amber-700">
                        ⚠️ Belum ada URL sumber (wajib verifikasi manual)
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Status Controls */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-stone-600">
                      <span>Ubah Status:</span>
                      <select
                        value={item.contentStatus}
                        onChange={(e) =>
                          handleQuickStatusUpdate(item.id, {
                            contentStatus: e.target.value as ContentStatus,
                          })
                        }
                        className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-800"
                      >
                        {CONTENT_STATUS_OPTIONS.filter(
                          (s) => s !== "archived"
                        ).map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-1.5 text-stone-600">
                      <span>Verifikasi:</span>
                      <select
                        value={item.verificationStatus}
                        onChange={(e) =>
                          handleQuickStatusUpdate(item.id, {
                            verificationStatus: e.target
                              .value as VerificationStatus,
                          })
                        }
                        className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-stone-800"
                      >
                        {VERIFICATION_STATUS_OPTIONS.map((vf) => (
                          <option key={vf} value={vf}>
                            {vf}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Arsipkan konten ${item.contentCode}? Konten yang diarsipkan tidak dihapus permanen.`
                        )
                      ) {
                        handleQuickStatusUpdate(item.id, {
                          contentStatus: "archived",
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded border border-stone-200 px-2.5 py-1 text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Arsipkan</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
