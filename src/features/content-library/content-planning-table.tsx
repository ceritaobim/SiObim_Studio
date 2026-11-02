"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  FolderPlus,
  RefreshCw,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  CalendarDays,
  Table2,
  Plus,
  Bot,
  Send,
  ShieldCheck,
  Clock,
  CalendarClock,
  X,
} from "lucide-react";
import type { AssetRecord, ContentItemRecord } from "@/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

interface ContentPlanningTableProps {
  initialItems: ContentItemRecord[];
  initialAssets?: AssetRecord[];
  initialGoogleSheetUrl: string;
  initialGoogleSheetWebAppUrl: string;
}

const DAY_NAMES_ID = [
  "Hari 1 (Senin)",
  "Hari 2 (Selasa)",
  "Hari 3 (Rabu)",
  "Hari 4 (Kamis)",
  "Hari 5 (Jumat)",
  "Hari 6 (Sabtu)",
  "Hari 7 (Minggu)",
];

interface AgentChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  weekNum: number;
  timestamp: string;
}

export function ContentPlanningTable({
  initialItems,
  initialAssets = [],
  initialGoogleSheetUrl,
  initialGoogleSheetWebAppUrl,
}: ContentPlanningTableProps) {
  const [items, setItems] = useState<ContentItemRecord[]>(initialItems);
  const [assets] = useState<AssetRecord[]>(initialAssets);
  const [sheetUrl, setSheetUrl] = useState(initialGoogleSheetUrl);
  const [webAppUrl, setWebAppUrl] = useState(initialGoogleSheetWebAppUrl);
  const [showGDriveSetup, setShowGDriveSetup] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");

  const [triggeringPlan, setTriggeringPlan] = useState(false);
  const [syncingGDrive, setSyncingGDrive] = useState(false);
  const [pullingGSheets, setPullingGSheets] = useState(false);

  // AI Agent Chat state per weekly customization
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<AgentChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      weekNum: 1,
      text: "Halo! Saya AI Content Strategist Anda. Pilih Week di dropdown, lalu ketik instruksi kustomisasi Anda di bawah (contoh: \"Ganti Hari 3 & Hari 5 jadi topik keuangan anak kos\" atau \"Buatkan Week 3 bertema psikologi kerjaan & hubungan\"). Saya otomatis mengecek seluruh minggu agar tidak pernah ada topik yang dobel.",
      timestamp: "Siap",
    },
  ]);

  const [editingScheduleItem, setEditingScheduleItem] =
    useState<ContentItemRecord | null>(null);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [autoScheduling, setAutoScheduling] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const getFolderInfo = (item: ContentItemRecord, idx: number) => {
    const match = item.contentCode.match(/(\d+)$/);
    const num = match?.[1] ? parseInt(match[1], 10) : idx + 1;
    const itemsPerWeek = 21;
    const weekNum = Math.max(1, Math.ceil(num / itemsPerWeek));
    const posInWeek = (num - 1) % itemsPerWeek;
    const dayNum = Math.floor(posInWeek / 3) + 1;
    const programSlot = (posInWeek % 3) + 1;
    const safeTitle = item.title
      .replace(/[^a-zA-Z0-9\s-_]/g, "")
      .trim()
      .slice(0, 42);
    return {
      weekNum,
      dayNum,
      programSlot,
      weekFolder: `Week_${String(weekNum).padStart(2, "0")}`,
      dayFolder: `Hari_${String(dayNum).padStart(2, "0")}_P${programSlot}_${item.contentCode}_${safeTitle}`,
      dayLabel: item.publishedAt || `Hari ${dayNum} (P${programSlot}) - 19:00 WIB`,
    };
  };

  const itemsWithMeta = items.map((item, idx) => ({
    item,
    folder: getFolderInfo(item, idx),
  }));

  // Count how many items exist per week
  const countByWeek = new Map<number, number>();
  let maxPopulatedWeek = 1;
  for (const entry of itemsWithMeta) {
    const w = entry.folder.weekNum;
    countByWeek.set(w, (countByWeek.get(w) ?? 0) + 1);
    if (w > maxPopulatedWeek) maxPopulatedWeek = w;
  }

  // Always offer at least up to maxPopulatedWeek + 3 in dropdown so user can open empty upcoming weeks
  const totalWeeksInDropdown = Math.max(8, maxPopulatedWeek + 3);
  const weekOptions = Array.from(
    { length: totalWeeksInDropdown },
    (_, i) => i + 1
  );

  // Find the first week that has 0 items
  const firstEmptyWeek =
    weekOptions.find((w) => (countByWeek.get(w) ?? 0) === 0) ??
    maxPopulatedWeek + 1;

  const selectedWeekLabel = `Week_${String(selectedWeekNum).padStart(2, "0")}`;
  const currentWeekEntries = itemsWithMeta.filter(
    (entry) => entry.folder.weekNum === selectedWeekNum
  );

  // Trigger 1: Generate 21 contents specifically for a target week (3 items per day across 3 programs)
  const handleTriggerGenerateForWeek = async (targetWeek: number) => {
    setTriggeringPlan(true);
    setFeedback(null);
    const targetLabel = `Week_${String(targetWeek).padStart(2, "0")}`;
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const createRes = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName: `Content Plan — Week ${targetWeek}`,
          targetWeekStart: todayIso,
          targetVideoCount: 21,
          customThemeHint:
            "3 Program Harian CeritaObim: Ke Dapur Yuk! (kuliner/dapur), Kepikiran Aja (psikologi/relatable), Eh, Ternyata! (fakta tak terduga)",
          autoCommit: true,
          targetWeekNumber: targetWeek,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(
          createData.error || "Gagal menjalankan trigger AI Content Plan."
        );
      }

      // Reload items and select that week
      const listRes = await fetch("/api/content", { cache: "no-store" });
      const listData = await listRes.json();
      if (listRes.ok && Array.isArray(listData.items)) {
        setItems(listData.items);
        setSelectedWeekNum(targetWeek);
      }

      const syncNote = createData.gsheetSyncMessage
        ? ` • ${createData.gsheetSyncMessage}`
        : "";

      setFeedback({
        type: "success",
        text: `Berhasil! ${
          createData.appendedCount ?? 21
        } konten baru (3 konten/hari) untuk ${targetLabel} selesai dibuat AI${syncNote}`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan trigger Content Plan.",
      });
    } finally {
      setTriggeringPlan(false);
    }
  };

  // Trigger 2: Sync to Google Spreadsheet AND auto-create folders in 01_Produksi_Harian
  const handleTriggerSyncAndCreateFolders = async () => {
    if (!webAppUrl.trim()) {
      setShowGDriveSetup(true);
      setFeedback({
        type: "error",
        text: "Masukkan URL Google Apps Script Web App Anda terlebih dahulu di kotak Koneksi GDrive di bawah agar website bisa membuat folder otomatis di 01_Produksi_Harian.",
      });
      return;
    }

    setSyncingGDrive(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/content/gsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "push",
          googleSheetUrl: sheetUrl,
          googleSheetWebAppUrl: webAppUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Gagal sinkronisasi ke Google Drive & Spreadsheet."
        );
      }

      setFeedback({
        type: "success",
        text: data.message,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal sinkronisasi ke Google Drive.",
      });
    } finally {
      setSyncingGDrive(false);
    }
  };

  // Trigger 3: Pull from Google Spreadsheet
  const handlePullFromGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      setShowGDriveSetup(true);
      setFeedback({
        type: "error",
        text: "Masukkan Link Google Spreadsheet ContentPlan_CeritaObim Anda terlebih dahulu.",
      });
      return;
    }

    setPullingGSheets(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/content/gsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pull_commit",
          googleSheetUrl: sheetUrl,
          googleSheetWebAppUrl: webAppUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menarik data dari Spreadsheet.");
      }

      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
      setFeedback({
        type: "success",
        text: `Berhasil menarik ${data.insertedCount} baris baru dari Google Spreadsheet Anda.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menarik data dari Spreadsheet.",
      });
    } finally {
      setPullingGSheets(false);
    }
  };

  const handleSaveGDriveUrls = async () => {
    try {
      const res = await fetch("/api/content/gsheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_urls",
          googleSheetUrl: sheetUrl,
          googleSheetWebAppUrl: webAppUrl,
        }),
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          text: "Link Google Spreadsheet & Web App GDrive berhasil disimpan!",
        });
      }
    } catch {
      // ignore
    }
  };

  const handleSaveSchedule = async (
    itemId: string,
    scheduledPublishAt: string | null
  ) => {
    setScheduleSubmitting(true);
    try {
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: itemId,
          scheduledPublishAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan jadwal upload.");

      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId ? { ...it, scheduledPublishAt } : it
        )
      );
      setEditingScheduleItem(null);
      setFeedback({
        type: "success",
        text: `Jadwal upload untuk ${data.item?.contentCode || "konten"} berhasil disimpan!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal menyimpan jadwal.",
      });
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleAutoScheduleWeek = async (weekNum: number) => {
    setAutoScheduling(true);
    setFeedback(null);
    try {
      const entries = currentWeekEntries;
      if (entries.length === 0) return;

      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + 1); // Start tomorrow
      baseDate.setHours(19, 0, 0, 0); // 19:00 WIB

      const updatedList = [...items];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry) continue;
        const { item, folder } = entry;
        const dayOffset = folder.dayNum - 1;
        const scheduledDate = new Date(
          baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000
        );
        const year = scheduledDate.getFullYear();
        const month = String(scheduledDate.getMonth() + 1).padStart(2, "0");
        const day = String(scheduledDate.getDate()).padStart(2, "0");
        const hours = String(scheduledDate.getHours()).padStart(2, "0");
        const minutes = String(scheduledDate.getMinutes()).padStart(2, "0");
        const isoWithTz = `${year}-${month}-${day}T${hours}:${minutes}:00+07:00`;

        await fetch("/api/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: item.id,
            scheduledPublishAt: isoWithTz,
          }),
        });

        const idx = updatedList.findIndex((it) => it.id === item.id);
        if (idx !== -1 && updatedList[idx]) {
          const currentItem = updatedList[idx]!;
          updatedList[idx] = { ...currentItem, scheduledPublishAt: isoWithTz };
        }
      }

      setItems(updatedList);
      setFeedback({
        type: "success",
        text: `Jadwal upload ${entries.length} video Week ${weekNum} berhasil diset berurutan jam 19:00 WIB!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: `Gagal mengatur jadwal otomatis: ${
          err instanceof Error ? err.message : "Error"
        }`,
      });
    } finally {
      setAutoScheduling(false);
    }
  };

  // AI Agent Chat handler for customizing the selected week's Content Plan
  const handleSendAgentChat = async (customPrompt?: string) => {
    const promptToSend = (customPrompt ?? chatInput).trim();
    if (!promptToSend || chatLoading) return;

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      weekNum: selectedWeekNum,
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setChatHistory((prev) => [...prev, userMsg]);
    if (!customPrompt) setChatInput("");
    setChatLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/content/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekNumber: selectedWeekNum,
          message: promptToSend,
          history: chatHistory.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Gagal menghubungi AI Agent Content Planning."
        );
      }

      if (Array.isArray(data.items)) {
        setItems(data.items);
      }

      const assistantMsg: AgentChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        weekNum: selectedWeekNum,
        text:
          data.agentReply ||
          `Content Plan Week ${selectedWeekNum} berhasil disesuaikan tanpa duplikat!`,
        timestamp: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setChatHistory((prev) => [...prev, assistantMsg]);
      setFeedback({
        type: "success",
        text: `AI Agent selesai memperbarui Week ${selectedWeekNum}!${
          data.gsheetSyncMessage ? ` • ${data.gsheetSyncMessage}` : ""
        }`,
      });
    } catch (err) {
      const errText =
        err instanceof Error
          ? err.message
          : "Gagal menjalankan kustomisasi AI Agent.";
      setChatHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          weekNum: selectedWeekNum,
          text: `Maaf, terjadi kendala: ${errText}`,
          timestamp: "Error",
        },
      ]);
      setFeedback({
        type: "error",
        text: errText,
      });
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Action Trigger Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div>
          <h2 className="text-sm font-bold text-stone-900 sm:text-base">
            Content Planning Mingguan & Otomatisasi GDrive
          </h2>
          <p className="text-xs text-stone-500">
            Pilih minggu melalui dropdown di tabel, beralih antara tampilan Tabel atau Kalender, dan buat Content Plan minggu baru dengan 1 klik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={syncingGDrive}
            onClick={handleTriggerSyncAndCreateFolders}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            <FolderPlus className="h-4 w-4" />
            <span>
              {syncingGDrive
                ? "Membuat Folder GDrive..."
                : "📁 Sync Sheet & Buat Folder GDrive"}
            </span>
          </button>

          <button
            type="button"
            disabled={pullingGSheets}
            onClick={handlePullFromGoogleSheet}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5 text-sky-600" />
            <span>{pullingGSheets ? "Menarik..." : "Tarik dari Sheet"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGDriveSetup((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-700 hover:bg-stone-100"
          >
            <span>Link GDrive</span>
            {showGDriveSetup ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Google Drive & Spreadsheet Link Setup */}
      {showGDriveSetup ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-amber-950">
              Pengaturan Link Spreadsheet (`ContentPlan_CeritaObim`) & Otomatisasi Folder (`01_Produksi_Harian`)
            </p>
            <a
              href="https://drive.google.com/drive/folders/1WV7zSGLishbjj9AnNf4Ro0XwYlkGa7f2?usp=sharing"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 font-bold text-emerald-900 hover:bg-emerald-200"
            >
              <span>Buka Folder GDrive CeritaObim_Studio</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-stone-700">
                1. Link Google Spreadsheet (Anyone with the link)
              </label>
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-stone-700">
                2. Aplikasi Web, URL (`https://script.google.com/.../exec`) atau ID Penerapan (`AKf...`)
              </label>
              <input
                type="text"
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="Paste URL Aplikasi Web (https://script.google.com/.../exec) di sini"
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleSaveGDriveUrls}
              className="rounded-lg bg-stone-900 px-3.5 py-1.5 font-semibold text-white hover:bg-stone-800"
            >
              Simpan Link GDrive
            </button>
            <a
              href="/api/content/export"
              className="inline-flex items-center gap-1 text-stone-700 font-semibold hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh Cadangan Excel (.xlsx)</span>
            </a>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
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

      {/* AI Agent Chat Customization Box per Weekly Plan */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-stone-50 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-stone-900 sm:text-sm">
                  Chat AI Agent — Kustomisasi Content Plan Week {selectedWeekNum}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <ShieldCheck className="h-3 w-3" />
                  Anti-Dobel Aktif ({items.length} Konten Dicek)
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                Minta AI mengubah hari tertentu atau menentukan tema khusus untuk{" "}
                <strong>Week {selectedWeekNum}</strong> tanpa mengulang topik minggu sebelumnya.
              </p>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                handleSendAgentChat(
                  `Buatkan atau perbarui Week ${selectedWeekNum} dengan fokus psikologi anak muda, overthinking, dan kebiasaan sehari-hari yang sedang relate.`
                )
              }
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            >
              ✨ Tema Psikologi & Relatable
            </button>
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                handleSendAgentChat(
                  `Ubah Hari 3 dan Hari 6 di Week ${selectedWeekNum} menjadi topik psikologi keuangan & kebiasaan belanja anak muda, pertahankan hari lainnya.`
                )
              }
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            >
              💸 Sisipkan Topik Keuangan
            </button>
            <button
              type="button"
              disabled={chatLoading}
              onClick={() =>
                handleSendAgentChat(
                  `Cek ulang seluruh 21 konten di Week ${selectedWeekNum}, pastikan hook 10 detik pertamanya lebih nendang dan tidak ada topik yang mirip dengan minggu lain.`
                )
              }
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50"
            >
              🔥 Pertajam Hook 10 Detik Awal
            </button>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="mt-3 max-h-48 overflow-y-auto space-y-2.5 pr-1">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-2xl rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 bg-white text-stone-800"
                }`}
              >
                <div className="mb-0.5 flex items-center gap-2 text-[10px] opacity-75">
                  <span className="font-bold">
                    {msg.role === "user" ? "Anda" : "AI Content Agent"}
                  </span>
                  <span>• Week {msg.weekNum}</span>
                  <span>• {msg.timestamp}</span>
                </div>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {chatLoading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900">
                🤖 AI Agent sedang menganalisis {items.length} konten yang ada agar tidak dobel & menyusun Week {selectedWeekNum}...
              </div>
            </div>
          ) : null}
        </div>

        {/* Chat Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendAgentChat();
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={chatLoading}
            placeholder={`Ketik instruksi untuk Week ${selectedWeekNum}... (misal: "Ganti Hari 2 jadi tentang susah fokus kerja, atau buatkan 21 konten bertema kesehatan tidur")`}
            className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={chatLoading || !chatInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{chatLoading ? "Memproses..." : `Kirim ke Week ${selectedWeekNum}`}</span>
          </button>
        </form>
      </div>

      {/* Main Content Planning Card with Week Dropdown + Table/Calendar Toggle */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label
                htmlFor="week-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-stone-400"
              >
                Pilih Minggu
              </label>
              <select
                id="week-select"
                value={selectedWeekNum}
                onChange={(e) => {
                  setSelectedWeekNum(Number(e.target.value));
                  setExpandedId(null);
                }}
                className="mt-0.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-900 focus:border-amber-600 focus:outline-none"
              >
                {weekOptions.map((w) => {
                  const count = countByWeek.get(w) ?? 0;
                  return (
                    <option key={w} value={w}>
                      Week {w} —{" "}
                      {count > 0 ? `(${count} Konten Siap)` : "(Belum Ada)"}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="pt-3.5">
              <button
                type="button"
                onClick={() => setSelectedWeekNum(firstEmptyWeek)}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
                title={`Lompat ke Week ${firstEmptyWeek} yang masih kosong`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Buka Week {firstEmptyWeek} (Baru)</span>
              </button>
            </div>
          </div>

          {/* Right Controls: View Switcher (Tabel vs Kalender) & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {currentWeekEntries.length > 0 ? (
              <button
                type="button"
                disabled={autoScheduling}
                onClick={() => handleAutoScheduleWeek(selectedWeekNum)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50 transition-colors shadow-2xs"
                title="Atur jadwal upload otomatis 1 video/hari jam 19:00 WIB untuk Buffer"
              >
                <CalendarClock className="h-3.5 w-3.5 text-amber-700" />
                <span>
                  {autoScheduling
                    ? "Menyinkronkan..."
                    : `Auto Jadwal Buffer (19:00 WIB)`}
                </span>
              </button>
            ) : null}

            <div className="inline-flex rounded-xl border border-stone-200 bg-stone-100 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-stone-900 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold transition-colors ${
                  viewMode === "calendar"
                    ? "bg-white text-stone-900 shadow-2xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Kalender</span>
              </button>
            </div>

            {sheetUrl ? (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-stone-50"
              >
                <span>Buka Sheet</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Empty State if Selected Week has NO Content Plan yet */}
        {currentWeekEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-bold text-stone-900">
              Week {selectedWeekNum} ({selectedWeekLabel}) Belum Memiliki Content Plan
            </h3>
            <p className="mt-1 max-w-md text-xs text-stone-500">
              Klik tombol di bawah untuk meminta AI menyusun 21 konten baru (3 konten per hari) khusus{" "}
              <strong>Week {selectedWeekNum}</strong> (lengkap dengan judul, deskripsi, narasi per 10 detik, dan folder otomatis di Google Drive).
            </p>
            <button
              type="button"
              disabled={triggeringPlan}
              onClick={() => handleTriggerGenerateForWeek(selectedWeekNum)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 sm:text-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {triggeringPlan
                  ? `Sedang Menyusun 21 Konten Week ${selectedWeekNum}...`
                  : `⚡ Buat Content Plan Week ${selectedWeekNum} (21 Konten)`}
              </span>
            </button>
          </div>
        ) : viewMode === "table" ? (
          /* TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  <th className="py-3 px-4">Minggu & Hari</th>
                  <th className="py-3 px-4">Jadwal Upload (Buffer)</th>
                  <th className="py-3 px-4">Judul</th>
                  <th className="py-3 px-4">Deskripsi / Caption</th>
                  <th className="py-3 px-4">Durasi</th>
                  <th className="py-3 px-4">Nama Folder GDrive Otomatis</th>
                  <th className="py-3 px-4 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {currentWeekEntries.map(({ item, folder }) => {
                  const isExpanded = expandedId === item.id;
                  const voiceAsset = assets.find(
                    (a) =>
                      a.contentId === item.id && a.assetType === "voice_audio"
                  );
                  const fixedAudioSeconds = voiceAsset?.durationMs
                    ? Math.round(voiceAsset.durationMs / 1000)
                    : null;

                  return (
                    <FragmentRow
                      key={item.id}
                      item={item}
                      fixedAudioSeconds={fixedAudioSeconds}
                      folder={folder}
                      isExpanded={isExpanded}
                      onToggle={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      onEditSchedule={() => setEditingScheduleItem(item)}
                      onCopy={(text, label) => {
                        navigator.clipboard.writeText(text);
                        setFeedback({
                          type: "success",
                          text: `${label} (${item.contentCode}) disalin ke clipboard!`,
                        });
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* CALENDAR VIEW (7-Day Weekly Grid) */
          <div className="p-5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-7">
              {DAY_NAMES_ID.map((dayTitle, idx) => {
                const dayNum = idx + 1;
                const entry =
                  currentWeekEntries.find(
                    (e) => e.folder.dayNum === dayNum
                  ) ?? currentWeekEntries[idx];

                if (!entry) {
                  return (
                    <div
                      key={dayTitle}
                      className="flex flex-col justify-between rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-3.5 min-h-44"
                    >
                      <span className="text-[11px] font-bold uppercase text-stone-400">
                        {dayTitle}
                      </span>
                      <span className="text-xs text-stone-400"> Kosong </span>
                    </div>
                  );
                }

                const { item, folder } = entry;
                const voiceAsset = assets.find(
                  (a) =>
                    a.contentId === item.id && a.assetType === "voice_audio"
                );
                const fixedAudioSeconds = voiceAsset?.durationMs
                  ? Math.round(voiceAsset.durationMs / 1000)
                  : null;
                const isExpanded = expandedId === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() =>
                      setExpandedId(isExpanded ? null : item.id)
                    }
                    className={`flex cursor-pointer flex-col justify-between rounded-xl border p-3.5 transition-all ${
                      isExpanded
                        ? "border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20"
                        : "border-stone-200 bg-white hover:border-amber-300 hover:shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold text-amber-800">
                          {dayTitle}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-stone-500">
                          {item.contentCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingScheduleItem(item);
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 hover:bg-amber-100 transition-colors"
                        title="Klik untuk ubah jadwal upload"
                      >
                        <Clock className="h-2.5 w-2.5 text-amber-600" />
                        <span>{formatWibSchedule(item.scheduledPublishAt)}</span>
                      </button>

                      <h4 className="mt-2 text-xs font-bold leading-snug text-stone-900">
                        {item.title}
                      </h4>

                      <p className="mt-1.5 line-clamp-3 text-[11px] text-stone-600">
                        {item.tiktokCaption || item.hook}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-stone-100 pt-2.5">
                      <div className="flex items-center justify-between text-[10px]">
                        {fixedAudioSeconds ? (
                          <span className="font-mono font-bold text-emerald-700">
                            {fixedAudioSeconds}s Fix
                          </span>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                            Belum Fix
                          </span>
                        )}
                        <span className="font-semibold text-stone-600 underline">
                          {isExpanded ? "Tutup" : "Lihat Narasi"}
                        </span>
                      </div>
                      <code className="mt-1.5 block truncate rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[9px] text-stone-600">
                        {folder.dayFolder}
                      </code>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded Narration Detail below Calendar Grid */}
            {expandedId ? (
              (() => {
                const activeEntry = currentWeekEntries.find(
                  (e) => e.item.id === expandedId
                );
                if (!activeEntry) return null;
                const { item, folder } = activeEntry;
                return (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-amber-900">
                          {item.contentCode}
                        </span>{" "}
                        •{" "}
                        <span className="font-bold text-stone-900">
                          {item.title}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-stone-500">
                          (01_Produksi_Harian/{folder.weekFolder}/{folder.dayFolder})
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.narration);
                            setFeedback({
                              type: "success",
                              text: `Narasi ${item.contentCode} disalin!`,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-800 hover:bg-stone-100"
                        >
                          <Copy className="h-3.5 w-3.5 text-amber-600" />
                          <span>Copy Narasi</span>
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-3 font-sans text-xs leading-relaxed text-stone-800">
                      {item.narration}
                    </pre>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}
      </div>

      {/* Schedule Picker Modal */}
      <SchedulePickerModal
        item={editingScheduleItem}
        isOpen={Boolean(editingScheduleItem)}
        onClose={() => setEditingScheduleItem(null)}
        onSave={handleSaveSchedule}
        isSubmitting={scheduleSubmitting}
      />
    </div>
  );
}

function FragmentRow({
  item,
  fixedAudioSeconds,
  folder,
  isExpanded,
  onToggle,
  onEditSchedule,
  onCopy,
}: {
  item: ContentItemRecord;
  fixedAudioSeconds: number | null;
  folder: { weekFolder: string; dayFolder: string; dayLabel: string };
  isExpanded: boolean;
  onToggle: () => void;
  onEditSchedule: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-stone-50/90 transition-colors"
      >
        <td className="py-3 px-4 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <StatusBadge label={folder.weekFolder} variant="info" />
            <span className="font-mono font-bold text-stone-900">
              {item.contentCode}
            </span>
          </div>
          <span className="mt-0.5 block text-[11px] text-stone-500">
            {folder.dayLabel}
          </span>
        </td>
        <td className="py-3 px-4 whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditSchedule();
            }}
            className="group inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-amber-400 hover:bg-amber-50/50 transition-colors shadow-2xs"
            title="Klik untuk atur atau ubah jadwal upload Buffer"
          >
            <Clock className="h-3.5 w-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
            <span>{formatWibSchedule(item.scheduledPublishAt)}</span>
          </button>
        </td>
        <td className="py-3 px-4 font-bold text-stone-900 max-w-xs">
          {item.title}
        </td>
        <td className="py-3 px-4 text-stone-600 max-w-xs">
          <p className="line-clamp-2">{item.tiktokCaption || item.hook}</p>
        </td>
        <td className="py-3 px-4 whitespace-nowrap">
          {fixedAudioSeconds ? (
            <div>
              <span className="font-mono font-bold text-emerald-700">
                {fixedAudioSeconds} dtk (Fix)
              </span>
              <span className="block text-[10px] text-stone-500">
                {Math.ceil(fixedAudioSeconds / 10)} klip @10s
              </span>
            </div>
          ) : (
            <div>
              <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                Belum Fix
              </span>
              <span className="mt-0.5 block text-[10px] text-stone-500">
                Menunggu Audio
              </span>
            </div>
          )}
        </td>
        <td className="py-3 px-4">
          <code className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-[11px] text-stone-700">
            01_Produksi_Harian/{folder.weekFolder}/{folder.dayFolder}
          </code>
        </td>
        <td className="py-3 px-4 text-right whitespace-nowrap">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-700 hover:bg-stone-100"
          >
            <span>{isExpanded ? "Tutup" : "Narasi"}</span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="bg-amber-50/30">
          <td colSpan={7} className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-stone-900">
                Narasi Penuh (
                {fixedAudioSeconds
                  ? `Durasi Audio Fix: ${fixedAudioSeconds} Detik`
                  : `${item.narration.length} Karakter • Durasi Fix Menunggu Audio ElevenLabs`}
                ):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onCopy(item.narration, "Narasi")}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                  <span>Copy Narasi</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(item.tiktokCaption, "Deskripsi")}
                  className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                >
                  <Copy className="h-3.5 w-3.5 text-amber-600" />
                  <span>Copy Deskripsi</span>
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl border border-stone-200 bg-white p-3 font-sans text-xs leading-relaxed text-stone-800">
              {item.narration}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function formatWibSchedule(isoStr?: string | null): string {
  if (!isoStr) return "Belum diatur";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return (
      new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(d) + " WIB"
    );
  } catch {
    return isoStr;
  }
}

function SchedulePickerModal({
  item,
  isOpen,
  onClose,
  onSave,
  isSubmitting,
}: {
  item: ContentItemRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (itemId: string, scheduledPublishAt: string | null) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (item?.scheduledPublishAt) {
      try {
        const d = new Date(item.scheduledPublishAt);
        const tzOffsetMs = d.getTimezoneOffset() * 60000;
        const localIso = new Date(d.getTime() - tzOffsetMs)
          .toISOString()
          .slice(0, 16);
        setCustomValue(localIso);
      } catch {
        setCustomValue("");
      }
    } else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(19, 0, 0, 0);
      const tzOffsetMs = d.getTimezoneOffset() * 60000;
      setCustomValue(
        new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16)
      );
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const setPreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(19, 0, 0, 0);
    const tzOffsetMs = d.getTimezoneOffset() * 60000;
    const localIso = new Date(d.getTime() - tzOffsetMs)
      .toISOString()
      .slice(0, 16);
    setCustomValue(localIso);
  };

  const handleApply = () => {
    if (!customValue) {
      onSave(item.id, null);
      return;
    }
    const d = new Date(customValue);
    onSave(item.id, d.toISOString());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold text-stone-900">
              Jadwal Upload Buffer
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-4">
          <div>
            <span className="font-mono text-xs font-bold text-amber-800">
              {item.contentCode}
            </span>
            <h4 className="mt-0.5 text-xs font-bold text-stone-900 line-clamp-1">
              {item.title}
            </h4>
            <p className="mt-1 text-[11px] text-stone-500">
              Jadwal ini disinkronkan ke Buffer Queue agar video ter-upload otomatis ke YouTube Shorts, TikTok, dan Instagram Reels.
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-700 block mb-1.5">
              Pilih Cepat (Preset 19:00 WIB)
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setPreset(0)}
                className="rounded-lg border border-stone-200 bg-stone-50 py-1.5 font-semibold text-stone-800 hover:border-amber-400 hover:bg-amber-50"
              >
                Hari Ini 19:00
              </button>
              <button
                type="button"
                onClick={() => setPreset(1)}
                className="rounded-lg border border-stone-200 bg-stone-50 py-1.5 font-semibold text-stone-800 hover:border-amber-400 hover:bg-amber-50"
              >
                Besok 19:00
              </button>
              <button
                type="button"
                onClick={() => setPreset(2)}
                className="rounded-lg border border-stone-200 bg-stone-50 py-1.5 font-semibold text-stone-800 hover:border-amber-400 hover:bg-amber-50"
              >
                Lusa 19:00
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-700 block mb-1">
              Pilih Tanggal & Jam Bebas
            </label>
            <input
              type="datetime-local"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-xs font-mono text-stone-900 shadow-2xs focus:border-amber-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onSave(item.id, null)}
            className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
          >
            Hapus Jadwal
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border border-stone-200 px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleApply}
              className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan..." : "Simpan Jadwal"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
