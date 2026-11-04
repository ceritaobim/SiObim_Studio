"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Download,
  CloudUpload,
  Copy,
  ExternalLink,
  FileText,
  X,
  Play,
  Clock,
  Sparkles,
  Pencil,
  Sliders,
  Lock,
  Save,
  KeyRound,
} from "lucide-react";
import type {
  AssetRecord,
  ContentItemRecord,
  SceneRecord,
} from "@/types/domain";
import { cleanNarrationForSpeech } from "@/lib/providers/tts/tts-provider";
import {
  DEFAULT_GDRIVE_ROOT_FOLDER_URL,
  GOOGLE_APPS_SCRIPT_SNIPPET,
} from "@/features/content-library/google-sheets-sync";

interface AudioTableManagerProps {
  initialItems: ContentItemRecord[];
  initialAssets: AssetRecord[];
  initialScenesByContent?: Record<string, SceneRecord[]>;
  ttsProviderLabel: string;
}

interface ApiResponsePayload {
  error?: string;
  scenes?: SceneRecord[];
  scene?: SceneRecord;
  voiceAsset?: AssetRecord;
  [key: string]: unknown;
}

async function safeParseJson(res: Response): Promise<ApiResponsePayload> {
  const text = await res.text();
  try {
    return JSON.parse(text) as ApiResponsePayload;
  } catch {
    if (res.status === 504) {
      throw new Error(
        "Server Timeout (504): Proses pembuatan audio/Google Drive membutuhkan waktu lebih lama dari batas Vercel. Silakan klik sekali lagi atau gunakan makro laptop."
      );
    }
    if (!res.ok) {
      throw new Error(`Server Error (${res.status}): ${text.slice(0, 150)}`);
    }
    throw new Error("Respons server bukan format JSON yang valid.");
  }
}

export function AudioTableManager({
  initialItems,
  initialAssets,
  initialScenesByContent = {},
  ttsProviderLabel,
}: AudioTableManagerProps) {
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets);
  const [scenesByContent, setScenesByContent] = useState<
    Record<string, SceneRecord[]>
  >(initialScenesByContent);
  const [selectedTranscriptItem, setSelectedTranscriptItem] =
    useState<ContentItemRecord | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio Playback Tracking & Timestamp Fine-Tuning States
  const [playbackTime, setPlaybackTime] = useState<number>(0);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editStartSec, setEditStartSec] = useState<number>(0);
  const [editEndSec, setEditEndSec] = useState<number>(0);
  const [isSavingTimestamp, setIsSavingTimestamp] = useState<boolean>(false);
  const [isRetranscribing, setIsRetranscribing] = useState<boolean>(false);

  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(() => {
    for (let idx = 0; idx < initialItems.length; idx++) {
      const it = initialItems[idx]!;
      const hasVoice = initialAssets.some(
        (a) => a.contentId === it.id && a.assetType === "voice_audio"
      );
      if (hasVoice) {
        const match = it.contentCode.match(/(\d+)$/);
        const num = match?.[1] ? parseInt(match[1], 10) : idx + 1;
        return Math.max(1, Math.ceil(num / 7));
      }
    }
    return 1;
  });
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [syncingDriveId, setSyncingDriveId] = useState<string | null>(null);
  const [syncingAllDrive, setSyncingAllDrive] = useState(false);
  const [triggeringBatch, setTriggeringBatch] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const [programFilter, setProgramFilter] = useState<string>("all");

  const hasAudioFor = (contentId: string) =>
    assets.find(
      (a) => a.contentId === contentId && a.assetType === "voice_audio"
    );

  const getWeekAndDay = (item: ContentItemRecord, idx: number) => {
    const match = item.contentCode.match(/(\d+)$/);
    const num = match?.[1] ? parseInt(match[1], 10) : idx + 1;
    const itemsPerWeek = 21;
    const weekNum = Math.max(1, Math.ceil(num / itemsPerWeek));
    const dayNum = Math.floor(((num - 1) % itemsPerWeek) / 3) + 1;
    const programSlot = ((num - 1) % 3) + 1;
    return { weekNum, dayNum, programSlot };
  };

  const itemsWithWeek = items.map((item, idx) => ({
    item,
    ...getWeekAndDay(item, idx),
  }));

  const maxWeek = Math.max(
    1,
    ...itemsWithWeek.map((entry) => entry.weekNum)
  );
  const weekOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);

  const filteredWeekItems = itemsWithWeek.filter((entry) => {
    if (entry.weekNum !== selectedWeekNum) return false;
    if (programFilter !== "all" && entry.item.programName !== programFilter) {
      return false;
    }
    return true;
  });

  const completedInWeek = filteredWeekItems.filter((e) =>
    Boolean(hasAudioFor(e.item.id))
  ).length;
  const totalCompletedAll = items.filter((i) => Boolean(hasAudioFor(i.id))).length;

  const nextPendingInWeek =
    filteredWeekItems.find((e) => !hasAudioFor(e.item.id))?.item ?? null;

  const triggerSingleAudio = async (item: ContentItemRecord) => {
    setTriggeringId(item.id);
    setFeedback(null);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "synthesize",
          contentId: item.id,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Gagal men-generate audio.");
      }

      const voiceAsset = data.voiceAsset;

      if (data.scenes && Array.isArray(data.scenes)) {
        const scenesList = data.scenes;
        setScenesByContent((prev) => ({
          ...prev,
          [item.id]: scenesList,
        }));
      }

      if (voiceAsset) {
        setAssets((prev) => [
          voiceAsset,
          ...prev.filter(
            (a) =>
              !(a.contentId === item.id && a.assetType === "voice_audio")
          ),
        ]);
      }

      const fixedSec = voiceAsset?.durationMs
        ? Math.round(voiceAsset.durationMs / 1000)
        : 80;
      const gdriveUploaded = Boolean(voiceAsset?.metadata?.gdriveUploaded);
      const gdriveNeedsUpdate = Boolean(
        voiceAsset?.metadata?.gdriveNeedsScriptUpdate
      );
      const gdriveFolder = String(
        voiceAsset?.metadata?.gdriveFolderPath ?? ""
      );

      if (gdriveNeedsUpdate) {
        setShowAppsScriptModal(true);
      }

      setFeedback({
        type: gdriveNeedsUpdate ? "warning" : "success",
        text: gdriveUploaded
          ? `Audio Obim (${item.contentCode}) selesai (${fixedSec}s • ${
              data.scenes?.length ?? 8
            } Bagian ≤10s) & OTOMATIS TERUPLOAD ke Google Drive (${gdriveFolder})!`
          : gdriveNeedsUpdate
          ? `Audio ${item.contentCode} selesai dibuat (${fixedSec}s), namun kode Google Apps Script Anda perlu di-update 1x agar file otomatis masuk ke folder ${gdriveFolder}.`
          : `Audio ${item.contentCode} selesai dibuat! Durasi fix: ${fixedSec} detik (${
              data.scenes?.length ?? Math.ceil(fixedSec / 10)
            } bagian ≤10s).`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan trigger audio.",
      });
    } finally {
      setTriggeringId(null);
    }
  };

  const handleOpenTranscript = async (item: ContentItemRecord) => {
    setSelectedTranscriptItem(item);
    setCopiedTranscript(false);
    setEditingSceneId(null);
    if (!scenesByContent[item.id]?.length) {
      try {
        const res = await fetch(
          `/api/voice?contentId=${encodeURIComponent(item.id)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.scenes && Array.isArray(data.scenes) && data.scenes.length > 0) {
            const scenesList: SceneRecord[] = data.scenes;
            setScenesByContent((prev) => ({
              ...prev,
              [item.id]: scenesList,
            }));
          }
        }
      } catch {
        // ignore
      }
    }
  };

  const handlePlayFrom = (sec: number) => {
    if (modalAudioRef.current) {
      modalAudioRef.current.currentTime = Math.max(0, sec);
      modalAudioRef.current.play().catch(() => {});
    }
  };

  const handleStartEditScene = (sc: SceneRecord) => {
    setEditingSceneId(sc.id);
    setEditStartSec(Math.round(sc.startMs / 100) / 10);
    setEditEndSec(Math.round(sc.endMs / 100) / 10);
  };

  const handleSaveEditScene = async (
    item: ContentItemRecord,
    sc: SceneRecord
  ) => {
    setIsSavingTimestamp(true);
    try {
      const res = await fetch("/api/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          sceneId: sc.id,
          startMs: Math.round(editStartSec * 1000),
          endMs: Math.round(editEndSec * 1000),
          narrationText: sc.narrationText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan timestamp.");
      }
      if (data.scenes && Array.isArray(data.scenes)) {
        const scenesList: SceneRecord[] = data.scenes;
        setScenesByContent((prev) => ({
          ...prev,
          [item.id]: scenesList,
        }));
      } else if (data.scene) {
        const updatedScene: SceneRecord = data.scene;
        setScenesByContent((prev) => ({
          ...prev,
          [item.id]: (prev[item.id] || []).map((s) =>
            s.id === sc.id ? updatedScene : s
          ),
        }));
      }
      setEditingSceneId(null);
      setFeedback({
        type: "success",
        text: `Timestamp Bagian ${sc.sceneIndex} berhasil disimpan! Bagian berikutnya otomatis digeser serentak dengan durasi tetap utuh.`,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal menyimpan perubahan.");
    } finally {
      setIsSavingTimestamp(false);
    }
  };

  const handleRetranscribe = async (item: ContentItemRecord) => {
    setIsRetranscribing(true);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retranscribe",
          contentId: item.id,
        }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal re-transkripsi audio.");
      if (data.scenes && Array.isArray(data.scenes)) {
        const scenesList: SceneRecord[] = data.scenes;
        setScenesByContent((prev) => ({
          ...prev,
          [item.id]: scenesList,
        }));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal re-transkripsi audio.");
    } finally {
      setIsRetranscribing(false);
    }
  };

  const handleSyncAllAudioInWeekToGDrive = async () => {
    const itemsWithAudio = filteredWeekItems
      .map((e) => e.item)
      .filter((i) => Boolean(hasAudioFor(i.id)));
    if (itemsWithAudio.length === 0) return;

    setSyncingAllDrive(true);
    setFeedback(null);
    let uploadedCount = 0;
    let needsScriptUpdate = false;

    try {
      for (const item of itemsWithAudio) {
        setSyncingDriveId(item.id);
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_gdrive",
            contentId: item.id,
          }),
        });
        const data = await safeParseJson(res);
        if (res.ok && data.voiceAsset) {
          const newAsset = data.voiceAsset;
          setAssets((prev) => [
            newAsset,
            ...prev.filter(
              (a) =>
                !(a.contentId === item.id && a.assetType === "voice_audio")
            ),
          ]);
          if (data.uploaded) uploadedCount++;
          if (data.needsAppsScriptUpdate) needsScriptUpdate = true;
        }
      }

      if (needsScriptUpdate) {
        setShowAppsScriptModal(true);
        setFeedback({
          type: "warning",
          text: `Kode Google Apps Script di Google Sheet Anda masih versi lama (belum mendukung upload file audio). Silakan Copy Kode Apps Script Baru di bawah lalu Deploy ulang 1x di script.google.com.`,
        });
      } else {
        setFeedback({
          type: "success",
          text: `Berhasil mengunggah ${uploadedCount} file Audio + Transkrip Prompt (.txt) Week ${selectedWeekNum} langsung ke folder masing-masing di Google Drive!`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menyinkronkan audio ke Google Drive.",
      });
    } finally {
      setSyncingDriveId(null);
      setSyncingAllDrive(false);
    }
  };

  const handleTriggerNextPending = async () => {
    if (!nextPendingInWeek) return;
    await triggerSingleAudio(nextPendingInWeek);
  };

  const handleTriggerAllPendingInWeek = async () => {
    const pendingList = filteredWeekItems
      .map((e) => e.item)
      .filter((i) => !hasAudioFor(i.id));
    if (pendingList.length === 0) return;

    setTriggeringBatch(true);
    setFeedback(null);
    let done = 0;

    try {
      for (const item of pendingList) {
        setTriggeringId(item.id);
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "synthesize",
            contentId: item.id,
          }),
        });
        const data = await safeParseJson(res);
        if (res.ok && data.voiceAsset) {
          const newAsset = data.voiceAsset;
          done++;
          setAssets((prev) => [
            newAsset,
            ...prev.filter(
              (a) =>
                !(a.contentId === item.id && a.assetType === "voice_audio")
            ),
          ]);
        }
      }
      setFeedback({
        type: "success",
        text: `Trigger Batch Audio Week ${selectedWeekNum} Selesai! ${done} konten berhasil dibuatkan suara narasinya & disinkronkan ke Google Drive.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan trigger batch audio.",
      });
    } finally {
      setTriggeringId(null);
      setTriggeringBatch(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Trigger Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Mic className="h-4 w-4 text-sky-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">
              Jobdesc 2: Audio Pipeline + Auto-Upload Google Drive • Week {selectedWeekNum} ({completedInWeek}/
              {filteredWeekItems.length} Selesai • Total {totalCompletedAll}/
              {items.length})
            </span>
          </div>
          <h1 className="mt-1 text-base font-bold text-stone-900 sm:text-lg">
            Generator Suara Obim (Puck Bold — Gemini AI) & Sinkronisasi Folder Google Drive
          </h1>
          <p className="text-xs text-stone-500">
            Setiap selesai generate audio, file <code>.wav/.mp3</code> beserta{" "}
            <code>TRANSKRIP_DAN_PROMPT.txt</code> otomatis diunggah ke{" "}
            <a
              href={DEFAULT_GDRIVE_ROOT_FOLDER_URL}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-sky-700 hover:underline inline-flex items-center gap-0.5"
            >
              <span>01_Produksi_Harian / Week_{String(selectedWeekNum).padStart(2, "0")}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowAppsScriptModal((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-700 hover:bg-stone-100"
          >
            <Copy className="h-3.5 w-3.5 text-amber-600" />
            <span>Kode Apps Script GDrive</span>
          </button>

          {nextPendingInWeek ? (
            <button
              type="button"
              disabled={Boolean(triggeringId) || triggeringBatch}
              onClick={handleTriggerNextPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              <span>
                ⚡ Trigger Berikutnya ({nextPendingInWeek.contentCode} •{" "}
                {cleanNarrationForSpeech(nextPendingInWeek.narration).length} kar)
              </span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={
              Boolean(triggeringId) ||
              triggeringBatch ||
              completedInWeek === filteredWeekItems.length
            }
            onClick={handleTriggerAllPendingInWeek}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-900 px-3.5 py-2.5 font-bold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4 text-amber-400" />
            <span>
              {triggeringBatch
                ? `Memproses Audio Week ${selectedWeekNum}...`
                : `Trigger Semua Week ${selectedWeekNum} (${
                    filteredWeekItems.length - completedInWeek
                  })`}
            </span>
          </button>
        </div>
      </div>

      {/* Collapsible Apps Script Updater Box */}
      {showAppsScriptModal ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong className="text-sm font-bold">
                📌 Update 1x Kode Google Apps Script (Agar Bisa Auto-Upload File Audio & Prompt .txt ke Folder GDrive)
              </strong>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Buka Google Sheet Anda &rarr; menu <strong>Ekstensi &gt; Apps Script</strong> &rarr; ganti seluruh isi <code>Code.gs</code> dengan kode di bawah &rarr; klik <strong>Terapkan (Deploy) &gt; Kelola penerapan &gt; Edit (ikon pensil) &gt; Versi: Versi Baru &gt; Terapkan</strong>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_SNIPPET);
                  setFeedback({
                    type: "success",
                    text: "Kode Google Apps Script (dengan fitur Auto-Upload Audio GDrive) berhasil disalin ke clipboard!",
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white hover:bg-amber-800"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Kode Apps Script Baru</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAppsScriptModal(false)}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
              >
                Tutup
              </button>
            </div>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-amber-200 bg-white p-3 font-mono text-[10px] text-stone-800">
            {GOOGLE_APPS_SCRIPT_SNIPPET}
          </pre>
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 text-xs sm:text-sm shadow-xs ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : feedback.type === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            )}
            <span className="leading-relaxed">{feedback.text}</span>
          </div>

          {(feedback.text.includes("Models Usage") ||
            feedback.text.includes("KUOTA_GEMINI_TTS_HABIS") ||
            feedback.text.includes("429")) && (
            <Link
              href="/models-usage"
              className="inline-flex items-center gap-1.5 self-start sm:self-center px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Buka Models Usage &amp; Ganti Akun ➔</span>
            </Link>
          )}
        </div>
      ) : null}

      {/* Main Audio Table with Week Filter & Google Drive Sync Button */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label
                htmlFor="audio-week-select"
                className="block text-[10px] font-bold uppercase tracking-wider text-stone-400"
              >
                Pilih Minggu
              </label>
              <select
                id="audio-week-select"
                value={selectedWeekNum}
                onChange={(e) => setSelectedWeekNum(Number(e.target.value))}
                className="mt-0.5 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-bold text-stone-900 focus:border-sky-600 focus:outline-none"
              >
                {weekOptions.map((w) => {
                  const weekItems = itemsWithWeek.filter(
                    (entry) => entry.weekNum === w
                  );
                  const done = weekItems.filter((entry) =>
                    Boolean(hasAudioFor(entry.item.id))
                  ).length;
                  return (
                    <option key={w} value={w}>
                      Week {w} — ({done}/{weekItems.length} Audio Selesai)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Filter Program
              </label>
              <div className="mt-0.5 flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setProgramFilter("all")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    programFilter === "all"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setProgramFilter("Ke Dapur Yuk!")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    programFilter === "Ke Dapur Yuk!"
                      ? "bg-amber-600 text-white"
                      : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                  }`}
                >
                  🍳 Ke Dapur Yuk!
                </button>
                <button
                  type="button"
                  onClick={() => setProgramFilter("Kepikiran Aja")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    programFilter === "Kepikiran Aja"
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                  }`}
                >
                  🌙 Kepikiran Aja
                </button>
                <button
                  type="button"
                  onClick={() => setProgramFilter("Eh, Ternyata!")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    programFilter === "Eh, Ternyata!"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  }`}
                >
                  💡 Eh, Ternyata!
                </button>
              </div>
            </div>

            {/* Tombol Sinkronisasi GDrive Per Week */}
            <div className="self-end">
              <button
                type="button"
                disabled={
                  completedInWeek === 0 ||
                  Boolean(syncingDriveId) ||
                  syncingAllDrive
                }
                onClick={handleSyncAllAudioInWeekToGDrive}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                title={`Upload seluruh audio (${completedInWeek}) yang sudah dibuat pada Week ${selectedWeekNum} ke Google Drive`}
              >
                <CloudUpload className="h-4 w-4" />
                <span>
                  {syncingAllDrive
                    ? `Mengunggah ke GDrive (${completedInWeek} Audio)...`
                    : `☁️ Sinkronkan Audio Week ${selectedWeekNum} ke Google Drive (${completedInWeek}/${filteredWeekItems.length})`}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold text-stone-500">
              Total:{" "}
              <strong className="font-mono text-stone-900">
                {filteredWeekItems.reduce(
                  (acc, e) =>
                    acc + cleanNarrationForSpeech(e.item.narration).length,
                  0
                )}{" "}
                karakter
              </strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-3 px-4">Judul</th>
                <th className="py-3 px-4 w-24">Durasi</th>
                <th className="py-3 px-4 w-44">Putar</th>
                <th className="py-3 px-4 w-28 text-center">Transkrip</th>
                <th className="py-3 px-4 w-32 text-center">Trigger</th>
                <th className="py-3 px-4 w-24 text-center">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredWeekItems.map(({ item, dayNum }) => {
                const audioAsset = hasAudioFor(item.id);
                const isRunning = triggeringId === item.id;
                const fixedDurationSec = audioAsset?.durationMs
                  ? Math.round(audioAsset.durationMs / 1000)
                  : null;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-stone-50/80 transition-colors"
                  >
                    {/* 1. Judul */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-0.5">
                        <span className="font-mono font-bold text-stone-700">
                          {item.contentCode}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-stone-600">
                          Hari {dayNum}
                        </span>
                      </div>
                      <p className="font-medium text-stone-900 line-clamp-2">
                        {item.title}
                      </p>
                      {item.programName && (
                        <span
                          className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
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
                    </td>

                    {/* 2. Durasi */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {fixedDurationSec ? (
                        <span className="font-mono font-bold text-emerald-700">
                          {fixedDurationSec} dtk
                        </span>
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">
                          -
                        </span>
                      )}
                    </td>

                    {/* 3. Putar */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {audioAsset ? (
                        <audio
                          controls
                          preload="none"
                          src={`/api/voice/stream?contentId=${encodeURIComponent(
                            item.id
                          )}&assetId=${encodeURIComponent(audioAsset.id)}`}
                          className="h-8 w-44"
                        />
                      ) : (
                        <span className="text-stone-400 italic text-[11px]">
                          -
                        </span>
                      )}
                    </td>

                    {/* 4. Transkrip Bertimestamp (Fitur Uji Akurasi) */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {audioAsset ? (
                        <button
                          type="button"
                          onClick={() => handleOpenTranscript(item)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 font-bold text-xs text-sky-800 hover:bg-sky-100 hover:border-sky-400 transition shadow-2xs cursor-pointer"
                          title={`Buka Transkrip Bertimestamp ${item.contentCode} untuk dicocokkan dengan audio`}
                        >
                          <FileText className="h-3.5 w-3.5 text-sky-600" />
                          <span>Transkrip</span>
                        </button>
                      ) : (
                        <span className="text-stone-300 font-mono text-[11px]">
                          -
                        </span>
                      )}
                    </td>

                    {/* 5. Trigger: Generate (jika sudah ada -> Regenerate) */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <button
                        type="button"
                        disabled={isRunning || triggeringBatch}
                        onClick={() => triggerSingleAudio(item)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-xs transition disabled:opacity-50 ${
                          audioAsset
                            ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                            : "bg-sky-600 text-white hover:bg-sky-700 shadow-xs"
                        }`}
                      >
                        <Zap
                          className={`h-3.5 w-3.5 ${
                            audioAsset ? "text-amber-500" : "text-amber-300"
                          }`}
                        />
                        <span>
                          {isRunning
                            ? "Memproses..."
                            : audioAsset
                            ? "Regenerate"
                            : "Generate"}
                        </span>
                      </button>
                    </td>

                    {/* 6. Download */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {audioAsset ? (
                        <a
                          href={`/api/voice/stream?contentId=${encodeURIComponent(
                            item.id
                          )}&assetId=${encodeURIComponent(
                            audioAsset.id
                          )}&download=1`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 font-semibold text-stone-700 hover:bg-stone-100 hover:text-stone-900 transition"
                          title={`Unduh ${audioAsset.originalFilename}`}
                        >
                          <Download className="h-3.5 w-3.5 text-stone-600" />
                          <span>Unduh</span>
                        </a>
                      ) : (
                        <span className="text-stone-300 font-mono text-[11px]">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Transkrip Bertimestamp Interaktif untuk Pencocokan Manual */}
      {selectedTranscriptItem && (() => {
        const item = selectedTranscriptItem;
        const audioAsset = hasAudioFor(item.id);
        const scenes = (scenesByContent[item.id] || [])
          .slice()
          .sort((a, b) => a.sceneIndex - b.sceneIndex);
        const totalSec = audioAsset?.durationMs
          ? Math.round((audioAsset.durationMs / 1000) * 10) / 10
          : 0;
        const formattedTranscriptText = scenes
          .map((sc) => {
            const startSec = (Math.round(sc.startMs / 100) / 10).toFixed(1);
            const endSec = (Math.round(sc.endMs / 100) / 10).toFixed(1);
            return `Bagian ${sc.sceneIndex} [${startSec}-${endSec}s] : ${sc.narrationText}`;
          })
          .join("\n\n");

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
            <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                        {item.contentCode}
                      </span>
                      <span className="text-[11px] font-semibold text-stone-500">
                        Uji & Cocokkan Transkrip Audio
                      </span>
                    </div>
                    <h3 className="font-bold text-stone-900 text-sm line-clamp-1">
                      {item.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTranscriptItem(null)}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sticky Audio Player & Interactive Controller */}
              <div className="border-b border-stone-200 bg-stone-900 p-4 text-white space-y-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-stone-200">
                      Pemutar Audio Manual
                    </span>
                    <span className="font-mono text-[11px] bg-stone-800 text-emerald-300 border border-stone-700 px-2 py-0.5 rounded">
                      ⏱️ Posisi: {playbackTime.toFixed(1)}s / {totalSec}s
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Tombol Re-Transcribe AI */}
                    <button
                      type="button"
                      disabled={isRetranscribing || !audioAsset}
                      onClick={() => handleRetranscribe(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-800 hover:bg-sky-700 px-2.5 py-1 text-xs font-bold text-sky-100 transition border border-sky-600 cursor-pointer disabled:opacity-50"
                      title="Analisis ulang audio dengan AI untuk mendeteksi jeda nafas lebih presisi"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span>
                        {isRetranscribing
                          ? "Menganalisis Audio..."
                          : "Transkrip Ulang via AI"}
                      </span>
                    </button>

                    {/* Tombol Copy Semua */}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(formattedTranscriptText);
                        setCopiedTranscript(true);
                        setTimeout(() => setCopiedTranscript(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-800 hover:bg-stone-700 px-2.5 py-1 text-xs font-semibold text-stone-200 transition border border-stone-700 cursor-pointer"
                    >
                      {copiedTranscript ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Semua Transkrip</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {audioAsset ? (
                  <audio
                    ref={modalAudioRef}
                    controls
                    preload="auto"
                    onTimeUpdate={(e) =>
                      setPlaybackTime(e.currentTarget.currentTime)
                    }
                    src={`/api/voice/stream?contentId=${encodeURIComponent(
                      item.id
                    )}&assetId=${encodeURIComponent(audioAsset.id)}`}
                    className="w-full h-9 rounded-lg"
                  />
                ) : (
                  <p className="text-xs text-amber-300 italic">
                    File audio belum tersedia untuk konten ini.
                  </p>
                )}

                <p className="text-[11px] text-stone-300 bg-stone-800/80 p-2 rounded-lg border border-stone-700/60 leading-normal">
                  💡 <strong>Cara Pengujian & Penyesuaian:</strong> Klik{" "}
                  <strong className="text-sky-300">&quot;▶️ Putar dari Xs&quot;</strong> untuk
                  melompat ke awal kalimat. Jika ada titik detik yang kurang pas,
                  klik{" "}
                  <strong className="text-amber-300">&quot;✏️ Sesuaikan Detik&quot;</strong>{" "}
                  lalu gunakan posisi audio saat ini untuk mengunci detik persisnya.
                </p>
              </div>

              {/* Scrollable Parts List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-stone-50/50">
                {scenes.length === 0 ? (
                  <div className="text-center py-12 text-stone-500 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="font-semibold text-sm">
                      Belum ada pecahan bagian scene untuk audio ini.
                    </p>
                    <p className="text-xs text-stone-400">
                      Klik tombol &quot;Transkrip Ulang via AI&quot; di atas atau Regenerate
                      di tabel audio.
                    </p>
                  </div>
                ) : (
                  scenes.map((sc, idx) => {
                    const startSec = Math.round(sc.startMs / 100) / 10;
                    const endSec = Math.round(sc.endMs / 100) / 10;
                    const durSec = (endSec - startSec).toFixed(1);
                    const isEditing = editingSceneId === sc.id;
                    const isActive =
                      playbackTime >= startSec &&
                      (idx === scenes.length - 1
                        ? playbackTime <= endSec + 0.5
                        : playbackTime < endSec);

                    const nextScene = scenes[idx + 1];
                    const nextDuration = nextScene
                      ? (
                          (nextScene.durationMs ||
                            nextScene.endMs - nextScene.startMs) / 1000
                        ).toFixed(1)
                      : null;
                    const nextNewEnd =
                      nextScene && nextDuration
                        ? (editEndSec + parseFloat(nextDuration)).toFixed(1)
                        : null;
                    const effectiveStartSec =
                      sc.sceneIndex === 1 ? editStartSec : startSec;
                    const effectiveDurSec = (
                      editEndSec - effectiveStartSec
                    ).toFixed(1);

                    return (
                      <div
                        key={sc.id}
                        className={`rounded-xl border p-3.5 transition space-y-2.5 ${
                          isActive
                            ? "border-sky-500 bg-sky-50/70 shadow-md ring-2 ring-sky-300"
                            : "border-stone-200 bg-white shadow-2xs hover:border-stone-300"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                              Bagian {sc.sceneIndex}
                            </span>
                            <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                              [{startSec.toFixed(1)}s - {endSec.toFixed(1)}s]
                            </span>
                            <span className="text-[11px] text-stone-500">
                              Durasi: {durSec}s
                            </span>
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white animate-pulse">
                                <Volume2 className="h-3 w-3" />
                                Sedang Bersuara
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePlayFrom(startSec)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800 transition cursor-pointer shadow-2xs"
                              title={`Lompat dan dengarkan dari detik ke-${startSec}`}
                            >
                              <Play className="h-3 w-3 fill-sky-800 text-sky-800" />
                              <span>Putar dari {startSec}s</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                isEditing
                                  ? setEditingSceneId(null)
                                  : handleStartEditScene(sc)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700 transition cursor-pointer"
                              title="Sesuaikan titik detik selesai kalimat ini"
                            >
                              <Pencil className="h-3 w-3 text-stone-500" />
                              <span>{isEditing ? "Batal" : "Sesuaikan"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Timestamp Editor */}
                        {isEditing ? (
                          <div className="bg-sky-50/95 border-2 border-sky-400 rounded-xl p-3.5 space-y-3 text-xs shadow-xs animate-in fade-in duration-150">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-200/80 pb-2.5">
                              <div className="flex items-center gap-2">
                                <strong className="text-sky-950 font-bold text-sm">
                                  ⏱️ Penyesuaian Bagian {sc.sceneIndex}
                                </strong>
                                {sc.sceneIndex > 1 ? (
                                  <span className="bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    🔒 Mulai Tersambung dari Bagian {sc.sceneIndex - 1}
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Bagian Pembuka (0.0s)
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {sc.sceneIndex === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditStartSec(
                                        Math.round(playbackTime * 10) / 10
                                      )
                                    }
                                    className="inline-flex items-center gap-1 bg-white hover:bg-sky-100 border border-sky-400 text-sky-800 text-[11px] font-bold px-2.5 py-1 rounded-md shadow-2xs cursor-pointer transition"
                                    title="Gunakan posisi audio saat ini sebagai detik mulai"
                                  >
                                    <Clock className="h-3 w-3 text-sky-600" />
                                    <span>
                                      Kunci Mulai ({playbackTime.toFixed(1)}s)
                                    </span>
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditEndSec(
                                      Math.round(playbackTime * 10) / 10
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-md shadow-2xs cursor-pointer transition"
                                  title="Gunakan posisi audio saat ini sebagai titik selesai kalimat"
                                >
                                  <Clock className="h-3.5 w-3.5 text-emerald-100" />
                                  <span>
                                    🎯 Kunci Selesai ({playbackTime.toFixed(1)}s)
                                  </span>
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {sc.sceneIndex === 1 ? (
                                <label className="flex items-center gap-1.5 font-bold text-stone-700">
                                  Mulai:
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={editStartSec}
                                    onChange={(e) =>
                                      setEditStartSec(
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-20 px-2 py-1 rounded-lg border border-stone-300 bg-white font-mono font-bold text-stone-900 focus:outline-sky-600"
                                  />
                                  s
                                </label>
                              ) : (
                                <div className="flex items-center gap-1.5 bg-white border border-sky-200 px-2.5 py-1 rounded-lg text-stone-600 font-semibold shadow-2xs">
                                  <Lock className="h-3 w-3 text-sky-600" />
                                  <span>Mulai:</span>
                                  <span className="font-mono font-bold text-stone-900">
                                    {startSec.toFixed(1)}s
                                  </span>
                                  <span className="text-[10px] text-stone-400 font-normal italic">
                                    (akhir Bagian {sc.sceneIndex - 1})
                                  </span>
                                </div>
                              )}

                              <label className="flex items-center gap-1.5 font-bold text-stone-900">
                                Selesai:
                                <input
                                  type="number"
                                  step="0.1"
                                  min={effectiveStartSec + 0.1}
                                  value={editEndSec}
                                  onChange={(e) =>
                                    setEditEndSec(
                                      parseFloat(e.target.value) ||
                                        effectiveStartSec + 1
                                    )
                                  }
                                  className="w-24 px-2.5 py-1 rounded-lg border-2 border-sky-500 bg-white font-mono font-bold text-sky-950 text-sm focus:outline-sky-600 shadow-2xs"
                                />
                                s
                              </label>

                              <span className="text-[11px] font-semibold text-stone-500">
                                Durasi Hasil:{" "}
                                <strong className="text-stone-800 font-mono">
                                  {effectiveDurSec}s
                                </strong>
                              </span>

                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  disabled={
                                    isSavingTimestamp ||
                                    editEndSec <= effectiveStartSec
                                  }
                                  onClick={() => handleSaveEditScene(item, sc)}
                                  className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  <span>
                                    {isSavingTimestamp
                                      ? "Menyimpan & Menggeser..."
                                      : "Simpan Detik & Geser Otomatis"}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSceneId(null)}
                                  className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold px-2.5 py-1.5 rounded-lg text-xs cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>

                            {/* Ripple Effect Notification Card */}
                            {nextScene ? (
                              <div className="bg-sky-100/80 border border-sky-300 rounded-lg p-2.5 text-[11px] text-sky-950 flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-sky-700 shrink-0 mt-0.5" />
                                <div>
                                  <strong className="text-sky-900 font-bold">
                                    🌊 Efek Geser Otomatis (Ripple Shift):
                                  </strong>{" "}
                                  Ketika detik selesai diubah ke{" "}
                                  <strong className="font-mono text-emerald-800 font-bold">
                                    {editEndSec.toFixed(1)}s
                                  </strong>
                                  , Bagian {nextScene.sceneIndex} akan otomatis
                                  mulai di detik{" "}
                                  <strong className="font-mono text-emerald-800 font-bold">
                                    {editEndSec.toFixed(1)}s
                                  </strong>{" "}
                                  hingga{" "}
                                  <strong className="font-mono text-emerald-800 font-bold">
                                    {nextNewEnd}s
                                  </strong>{" "}
                                  (durasi {nextDuration}s tetap utuh terjaga). Semua
                                  bagian berikutnya ikut menyesuaikan serentak!
                                </div>
                              </div>
                            ) : (
                              <div className="bg-stone-100 border border-stone-200 rounded-lg p-2 text-[11px] text-stone-600">
                                Ini adalah bagian terakhir dari rekaman audio.
                              </div>
                            )}

                            {editEndSec <= effectiveStartSec ? (
                              <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                                ⚠️ Detik selesai ({editEndSec.toFixed(1)}s) harus
                                lebih besar dari detik mulai (
                                {effectiveStartSec.toFixed(1)}s).
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <p className="text-xs sm:text-sm font-medium text-stone-800 bg-stone-50/80 p-2.5 rounded-lg border border-stone-200 leading-relaxed font-sans">
                          &ldquo;{sc.narrationText}&rdquo;
                        </p>

                        {sc.visualAction ? (
                          <div className="flex items-start gap-1.5 text-[11px] text-stone-500 pt-0.5">
                            <span className="font-semibold text-stone-600 shrink-0">
                              🎬 Aksi Origami:
                            </span>
                            <span className="line-clamp-2">
                              {sc.visualAction}
                            </span>
                          </div>
                        ) : null}

                        {sc.sfxCue ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 pt-0.5">
                            <Volume2 className="h-3 w-3 shrink-0" />
                            <span className="font-semibold">SFX Cue:</span>
                            <span>{sc.sfxCue}</span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-stone-200 bg-stone-50 px-5 py-3 flex items-center justify-between text-xs text-stone-500">
                <span>
                  {scenes.length > 0
                    ? `Terverifikasi ${scenes.length} bagian bertimestamp.`
                    : "Menunggu data transkrip..."}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTranscriptItem(null)}
                  className="rounded-lg bg-stone-800 px-4 py-1.5 font-bold text-white hover:bg-stone-900 transition cursor-pointer"
                >
                  Selesai Mencocokkan
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
