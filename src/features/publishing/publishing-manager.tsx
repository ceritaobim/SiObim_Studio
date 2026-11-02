"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Layers,
  Search,
  Filter,
  Eye,
  EyeOff,
  Video,
  Download,
  X,
  ExternalLink,
  ChevronDown,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Music,
  ThumbsUp,
  ThumbsDown,
  Disc,
  Volume2,
  VolumeX,
  Copy,
  Check,
} from "lucide-react";
import type {
  ContentItemRecord,
  PlatformPublicationRecord,
  AssetRecord,
} from "@/types/domain";
import { useStudioMode } from "@/context/studio-mode-context";
import { StatusBadge } from "@/components/ui/status-badge";
import { SocialCopyEditorModal } from "./social-copy-editor-modal";

interface BufferChannel {
  id: string;
  name: string;
  displayName: string;
  service: string;
}

interface PublishingManagerProps {
  initialItems: ContentItemRecord[];
  initialPublications: PlatformPublicationRecord[];
  initialAssets: AssetRecord[];
}

function getSafeFinalFilename(title: string): string {
  const safe = (title || "").replace(/[?:/*"<>|\\]/g, "").trim();
  return `final-${safe}.mp4`;
}

function getPlatformCopy(
  item: ContentItemRecord,
  platform: "tiktok" | "instagram" | "youtube"
): string {
  const defaultHashtags = "#CeritaObim #FaktaUnik #Sains #Origami #Animasi #FYP";
  if (platform === "tiktok") {
    return (
      item.tiktokCaption?.trim() ||
      `${item.title}\n\n${item.hook || ""}\n\n${
        item.cta || "Apa pendapatmu? Tulis di kolom komentar!"
      }\n\n${defaultHashtags}`.trim()
    );
  }
  if (platform === "instagram") {
    return (
      item.instagramCaption?.trim() ||
      `${item.title} ✨\n\n${item.hook || ""}\n\n${
        item.cta || "Yuk diskusi di kolom komentar!"
      }\n.\n.\n#ceritaobim #faktaunik #sainsindonesia #origami #stopmotion #reelsindonesia`.trim()
    );
  }
  return (
    item.youtubeDescription?.trim() ||
    `${item.title}\n\n${item.hook || ""}\n\n${
      item.cta || "Subscribe untuk fakta unik CeritaObim setiap hari!"
    }\n\n#shorts #ceritaobim #faktaunik #edukasi`.trim()
  );
}

function formatPublishSchedule(isoStr?: string | null) {
  if (!isoStr) {
    return {
      dateLabel: "Belum Dijadwalkan",
      timeLabel: "-",
      relativeLabel: "",
      formattedDateTime: "Belum dijadwalkan",
      isPast: false,
    };
  }

  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return {
      dateLabel: isoStr,
      timeLabel: "-",
      relativeLabel: "",
      formattedDateTime: isoStr,
      isPast: false,
    };
  }

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];

  // Convert to UTC+7 (WIB)
  const utcMs = d.getTime();
  const wibMs = utcMs + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);

  const dayName = dayNames[wibDate.getUTCDay()];
  const dayNum = wibDate.getUTCDate();
  const monthName = monthNames[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = String(wibDate.getUTCHours()).padStart(2, "0");
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, "0");

  const dateLabel = `${dayName}, ${dayNum} ${monthName} ${year}`;
  const timeLabel = `${hours}:${minutes} WIB`;
  const formattedDateTime = `${dateLabel} • ${timeLabel}`;

  const now = new Date();
  const diffDays = Math.round(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  let relativeLabel = "";
  let isPast = false;

  if (d.getTime() < now.getTime()) {
    isPast = true;
    relativeLabel = "Waktu lewat";
  } else if (diffDays === 0) {
    relativeLabel = "Hari ini";
  } else if (diffDays === 1) {
    relativeLabel = "Besok";
  } else {
    relativeLabel = `${diffDays} hari lagi`;
  }

  return { dateLabel, timeLabel, relativeLabel, formattedDateTime, isPast };
}

function toDatetimeLocalValue(isoStr?: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const wibDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibDate.getUTCFullYear();
  const mm = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(wibDate.getUTCDate()).padStart(2, "0");
  const hh = String(wibDate.getUTCHours()).padStart(2, "0");
  const min = String(wibDate.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function PublishingManager({
  initialItems,
  initialPublications,
  initialAssets,
}: PublishingManagerProps) {
  const { isAdvance } = useStudioMode();
  const [items, setItems] = useState<ContentItemRecord[]>(initialItems);
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets);
  const [isBatchAssembling, setIsBatchAssembling] = useState(false);
  const [assemblingMap, setAssemblingMap] = useState<Record<string, boolean>>({});
  const [channels, setChannels] = useState<BufferChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  // Filter & Search states
  const [filterTab, setFilterTab] = useState<
    "all" | "ready" | "published" | "not_ready"
  >("all");
  const [hidePublished, setHidePublished] = useState(false);
  const [onlyFinalReady, setOnlyFinalReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  // Interaction states
  const [editingContent, setEditingContent] =
    useState<ContentItemRecord | null>(null);
  const [previewContent, setPreviewContent] =
    useState<ContentItemRecord | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<
    "tiktok" | "instagram" | "youtube"
  >("tiktok");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleCopyCaption = (text: string, platform: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedPlatform(platform);
      setTimeout(() => {
        setCopiedPlatform(null);
      }, 2000);
    }
  };

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(
    null
  );
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, string>>(
    {}
  );
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [publishingMap, setPublishingMap] = useState<
    Record<string, "now" | "schedule">
  >({});
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const [selectedPlatformsMap, setSelectedPlatformsMap] = useState<
    Record<string, string[]>
  >({});

  // Sort items by contentCode
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.contentCode.localeCompare(b.contentCode));
  }, [items]);

  // Load connected Buffer channels
  const loadChannels = async () => {
    setLoadingChannels(true);
    setChannelError(null);
    try {
      const res = await fetch("/api/buffer/channels");
      const data = await res.json();
      if (res.ok && Array.isArray(data.channels)) {
        setChannels(data.channels);
      } else {
        setChannelError(data.error || "Gagal memuat channel Buffer.");
      }
    } catch (err) {
      setChannelError(
        err instanceof Error ? err.message : "Koneksi ke Buffer gagal."
      );
    } finally {
      setLoadingChannels(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const getFinalVideo = (contentId: string) => {
    return assets.find(
      (a) => a.contentId === contentId && a.assetType === "final_video"
    );
  };

  // Toggle platform selection for a content item
  const togglePlatform = (contentId: string, platform: string) => {
    setSelectedPlatformsMap((prev) => {
      const current = prev[contentId] || ["youtube", "tiktok", "instagram"];
      const exists = current.includes(platform);
      if (exists && current.length === 1) {
        return prev; // keep at least 1
      }
      const updated = exists
        ? current.filter((p) => p !== platform)
        : [...current, platform];
      return { ...prev, [contentId]: updated };
    });
  };

  // Save updated schedule date/time inline
  const handleSaveSchedule = async (contentId: string) => {
    const rawVal = scheduleInputs[contentId];
    if (!rawVal) return;

    setSavingScheduleId(contentId);
    try {
      // Convert to ISO with +07:00
      const newIso = `${rawVal}:00+07:00`;
      const res = await fetch("/api/content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contentId,
          scheduledPublishAt: newIso,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan jadwal tayang.");
      }

      setItems((prev) =>
        prev.map((it) =>
          it.id === contentId ? { ...it, scheduledPublishAt: newIso } : it
        )
      );
      setEditingScheduleId(null);
      setFeedback({
        type: "success",
        text: "Jadwal tayang berhasil diperbarui!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal memperbarui jadwal tayang.",
      });
    } finally {
      setSavingScheduleId(null);
    }
  };

  // Handle Publish / Schedule trigger
  const handlePublish = async (
    item: ContentItemRecord,
    options?: { publishNow?: boolean }
  ) => {
    const publishNow = Boolean(options?.publishNow);
    const mode = publishNow ? "now" : "schedule";
    setPublishingMap((prev) => ({ ...prev, [item.id]: mode }));
    setFeedback(null);

    const platforms = selectedPlatformsMap[item.id] || [
      "youtube",
      "tiktok",
      "instagram",
    ];
    const scheduledTime = publishNow
      ? undefined
      : item.scheduledPublishAt || undefined;

    try {
      const res = await fetch("/api/buffer/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          targetPlatforms: platforms,
          scheduledTime,
          publishNow,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mempublish video ke Buffer.");
      }

      if (data.ok) {
        const modeNote = publishNow
          ? " (⚡ Tayang Sekarang!)"
          : scheduledTime
          ? ` (📅 Terjadwal: ${formatPublishSchedule(scheduledTime).formattedDateTime})`
          : " (Antrean Buffer)";
        setFeedback({
          type: "success",
          text: `🎉 Sukses! Video "${item.title}" berhasil diunggah ke Buffer untuk ${data.successCount} channel medsos${modeNote}! File master: ${getSafeFinalFilename(item.title)}`,
        });
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, contentStatus: "published" } : it
          )
        );
      } else {
        const errorDetail = data.results
          ?.filter((r: { ok: boolean; error?: string }) => !r.ok)
          .map((r: { service: string; error?: string }) => `${r.service}: ${r.error}`)
          .join(" | ");
        setFeedback({
          type: "warning",
          text: `Sebagian channel gagal dikirim: ${errorDetail}`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat publish ke Buffer.",
      });
    } finally {
      setPublishingMap((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }
  };

  // Trigger single content assembly
  const handleAssembleSingle = async (contentId: string) => {
    setAssemblingMap((prev) => ({ ...prev, [contentId]: true }));
    setFeedback(null);
    try {
      const res = await fetch("/api/assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal merakit video.");
      }

      if (data.finalVideoAsset) {
        setAssets((prev) => [
          ...prev.filter(
            (a) => !(a.contentId === contentId && a.assetType === "final_video")
          ),
          data.finalVideoAsset,
        ]);
        setFeedback({
          type: "success",
          text: `🎉 Berhasil! Video master "${data.finalVideoAsset.originalFilename}" sukses dirakit otomatis dan siap dijadwalkan!`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal merakit video final.",
      });
    } finally {
      setAssemblingMap((prev) => {
        const next = { ...prev };
        delete next[contentId];
        return next;
      });
    }
  };

  // Trigger batch auto-assembly across dropzones & all items
  const handleBatchAutoAssemble = async () => {
    setIsBatchAssembling(true);
    setFeedback(null);
    try {
      // 1. Scan dropzones first
      try {
        await fetch("/api/macro/sync", { method: "POST" });
      } catch {}

      // 2. Trigger batch assembly
      const res = await fetch("/api/assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_assemble" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menjalankan perakitan otomatis.");
      }

      setFeedback({
        type: "success",
        text:
          data.message ||
          `🎉 Batch perakitan selesai! ${data.assembledCount ?? 0} video baru berhasil dirakit.`,
      });

      // Reload to ensure full DB state sync
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan perakitan batch.",
      });
      setIsBatchAssembling(false);
    }
  };

  // Compute stats
  const totalCount = sortedItems.length;
  const readyCount = sortedItems.filter((i) => Boolean(getFinalVideo(i.id))).length;
  const publishedCount = sortedItems.filter(
    (i) => i.contentStatus === "published"
  ).length;
  const notReadyCount = totalCount - readyCount;

  // Filtered Items logic
  const filteredItems = useMemo(() => {
    return sortedItems.filter((item, idx) => {
      const finalVid = getFinalVideo(item.id);
      const isReady = Boolean(finalVid);
      const isPublished = item.contentStatus === "published";
      const weekNum = Math.floor(idx / 7) + 1;

      // Tab filter
      if (filterTab === "ready" && !isReady) return false;
      if (filterTab === "published" && !isPublished) return false;
      if (filterTab === "not_ready" && isReady) return false;

      // Hide toggles
      if (hidePublished && isPublished) return false;
      if (onlyFinalReady && !isReady) return false;

      // Week filter
      if (selectedWeek !== "all" && String(weekNum) !== selectedWeek) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchCode = item.contentCode.toLowerCase().includes(q);
        const matchFilename = getSafeFinalFilename(item.title).toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchFilename) return false;
      }

      return true;
    });
  }, [
    sortedItems,
    filterTab,
    hidePublished,
    onlyFinalReady,
    selectedWeek,
    searchQuery,
    assets,
  ]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Buffer Channel Hub Bar */}
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black text-base shadow-sm">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">
                  Buffer Publishing &amp; Scheduling Studio
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  API Terkoneksi
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Kelola jadwal upload dan trigger penerbitan video master <strong>final-[judul].mp4</strong> serentak ke 3 medsos resmi.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBatchAutoAssemble}
              disabled={isBatchAssembling}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-2xs disabled:opacity-50"
              title="Pindai folder dropzone dan rakit otomatis seluruh konten yang klipnya sudah lengkap"
            >
              <Sparkles className={`h-3.5 w-3.5 ${isBatchAssembling ? "animate-spin" : ""}`} />
              <span>{isBatchAssembling ? "Memindai & Merakit..." : "⚡ Scan Dropzone & Rakit Otomatis"}</span>
            </button>
            <button
              type="button"
              onClick={loadChannels}
              disabled={loadingChannels}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingChannels ? "animate-spin" : ""}`}
              />
              <span>Refresh Channel</span>
            </button>
            <Link
              href="/assets"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Video Studio &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Channels badges */}
        <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">
            Connected Channels:
          </span>
          <div className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-1 font-bold text-rose-900">
            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white font-black">
              YT
            </span>
            <span>YouTube Shorts (@obim)</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100/80 px-3 py-1 font-bold text-slate-900">
            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white font-black">
              TT
            </span>
            <span>TikTok (@cerita_obim)</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/70 px-3 py-1 font-bold text-purple-900">
            <span className="rounded bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-1.5 py-0.5 text-[10px] text-white font-black">
              IG
            </span>
            <span>Instagram Reels (@cerita_obim)</span>
          </div>
        </div>
      </div>

      {/* 2. Notification / Feedback banner */}
      {feedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-2xl p-4 text-xs font-semibold shadow-xs ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : feedback.type === "warning"
              ? "border border-amber-200 bg-amber-50 text-amber-900"
              : "border border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 3. Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Total Konten
          </p>
          <p className="mt-1 text-2xl font-black text-slate-900">
            {totalCount}
          </p>
          <span className="text-[10px] text-slate-400">Rencana Batch 1</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
            Video Final Siap
          </p>
          <p className="mt-1 text-2xl font-black text-emerald-700">
            {readyCount}
          </p>
          <span className="text-[10px] text-emerald-600 font-semibold">
            Format final-[judul].mp4
          </span>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">
            Sudah Tayang
          </p>
          <p className="mt-1 text-2xl font-black text-indigo-700">
            {publishedCount}
          </p>
          <span className="text-[10px] text-indigo-600 font-semibold">
            Published via Buffer
          </span>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-2xs">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">
            Belum Dirakit
          </p>
          <p className="mt-1 text-2xl font-black text-amber-700">
            {notReadyCount}
          </p>
          <span className="text-[10px] text-amber-600 font-semibold">
            Butuh klip di Studio
          </span>
        </div>
      </div>

      {/* 4. Table Filter & Controls Toolbar */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterTab === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Semua ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("ready")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterTab === "ready"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Siap Publish ({readyCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("published")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterTab === "published"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
              }`}
            >
              Sudah Tayang ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("not_ready")}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filterTab === "not_ready"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              Belum Dirakit ({notReadyCount})
            </button>
          </div>

          {/* Search Bar & Week Select */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">Semua Minggu</option>
              <option value="1">Minggu 1</option>
              <option value="2">Minggu 2</option>
              <option value="3">Minggu 3</option>
            </select>
          </div>
        </div>

        {/* Hide/Unhide Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hidePublished}
                onChange={(e) => setHidePublished(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">
                Sembunyikan yang sudah tayang
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyFinalReady}
                onChange={(e) => setOnlyFinalReady(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold text-slate-700">
                Hanya tampilkan yang video finalnya sudah siap
              </span>
            </label>
          </div>

          <span className="text-[11px] font-bold text-slate-400">
            Menampilkan {filteredItems.length} dari {totalCount} konten
          </span>
        </div>
      </div>

      {/* 5. The Table of Content & Final Videos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-600">
                <th className="py-3.5 px-4 w-32">Kode &amp; Hari</th>
                <th className="py-3.5 px-4 min-w-[280px]">Judul &amp; File Master Final</th>
                <th className="py-3.5 px-4 min-w-[220px]">Jadwal Upload (WIB)</th>
                <th className="py-3.5 px-4 w-28">Channels</th>
                <th className="py-3.5 px-4 w-28">Status</th>
                <th className="py-3.5 px-4 min-w-[260px] text-right">Trigger Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Video className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">
                      Tidak ada konten yang sesuai dengan filter.
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Coba ganti filter tab atau batalkan pencarian.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, originalIndex) => {
                  const finalVid = getFinalVideo(item.id);
                  const isReady = Boolean(finalVid);
                  const publishingMode = publishingMap[item.id];
                  const isPublishing = Boolean(publishingMode);
                  const isPublishingNow = publishingMode === "now";
                  const isPublishingSchedule = publishingMode === "schedule";
                  const isAssembling = Boolean(assemblingMap[item.id]);
                  const isPublished = item.contentStatus === "published";
                  const scheduleInfo = formatPublishSchedule(
                    item.scheduledPublishAt
                  );
                  const safeFilename = getSafeFinalFilename(item.title);

                  // Calculate index in sorted list to get accurate week & day
                  const itemIndex = sortedItems.findIndex(
                    (it) => it.id === item.id
                  );
                  const weekNum = Math.floor(itemIndex / 7) + 1;
                  const dayNum = (itemIndex % 7) + 1;

                  const currentPlatforms = selectedPlatformsMap[item.id] || [
                    "youtube",
                    "tiktok",
                    "instagram",
                  ];

                  const isEditingSchedule = editingScheduleId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      {/* 1. Kode & Hari */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          <span className="inline-block font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md text-[11px]">
                            {item.contentCode}
                          </span>
                          <span className="block text-[10px] font-bold text-slate-500">
                            W{weekNum} • H{dayNum}
                          </span>
                        </div>
                      </td>

                      {/* 2. Judul & File Master Final */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug">
                            {item.title}
                          </h4>

                          {/* File info badge */}
                          {isReady ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md"
                                title={`File: ${safeFilename}`}
                              >
                                <Video className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[200px]">
                                  {safeFilename}
                                </span>
                              </span>

                              {finalVid?.sizeBytes && (
                                <span className="text-[10px] text-slate-400">
                                  {(
                                    finalVid.sizeBytes /
                                    (1024 * 1024)
                                  ).toFixed(1)}{" "}
                                  MB
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => setPreviewContent(item)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                              >
                                <Play className="h-3 w-3" />
                                <span>Preview</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                Belum Dirakit
                              </span>
                              <button
                                type="button"
                                disabled={isAssembling}
                                onClick={() => handleAssembleSingle(item.id)}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-100/70 px-2 py-0.5 text-[10px] font-bold text-amber-900 hover:bg-amber-200 transition-colors shadow-2xs"
                                title="Jalankan perakitan video otomatis jika seluruh klip bagian sudah lengkap"
                              >
                                <Sparkles className={`h-2.5 w-2.5 ${isAssembling ? "animate-spin" : ""}`} />
                                <span>{isAssembling ? "Merakit..." : "🔨 Rakit Video"}</span>
                              </button>
                              <Link
                                href="/assets"
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                              >
                                Studio &rarr;
                              </Link>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Jadwal Upload (WIB) */}
                      <td className="py-3.5 px-4 align-top">
                        {isEditingSchedule ? (
                          <div className="space-y-1.5">
                            <input
                              type="datetime-local"
                              defaultValue={
                                scheduleInputs[item.id] ??
                                toDatetimeLocalValue(item.scheduledPublishAt)
                              }
                              onChange={(e) =>
                                setScheduleInputs((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800"
                            />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={savingScheduleId === item.id}
                                onClick={() => handleSaveSchedule(item.id)}
                                className="rounded-md bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-indigo-700"
                              >
                                {savingScheduleId === item.id
                                  ? "..."
                                  : "Simpan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingScheduleId(null)}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-slate-800 font-bold">
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{scheduleInfo.timeLabel}</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {scheduleInfo.dateLabel}
                            </p>
                            <div className="flex items-center gap-2">
                              {scheduleInfo.relativeLabel && (
                                <span
                                  className={`inline-block rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                    scheduleInfo.isPast
                                      ? "bg-slate-100 text-slate-500"
                                      : "bg-indigo-50 text-indigo-700"
                                  }`}
                                >
                                  {scheduleInfo.relativeLabel}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setScheduleInputs((prev) => ({
                                    ...prev,
                                    [item.id]: toDatetimeLocalValue(
                                      item.scheduledPublishAt
                                    ),
                                  }));
                                  setEditingScheduleId(item.id);
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:underline"
                              >
                                Ubah
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 4. Target Platform Channels */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => togglePlatform(item.id, "youtube")}
                            title={
                              currentPlatforms.includes("youtube")
                                ? "YouTube Aktif (klik untuk matikan)"
                                : "YouTube Nonaktif (klik untuk aktifkan)"
                            }
                            className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-black transition-colors ${
                              currentPlatforms.includes("youtube")
                                ? "bg-rose-600 text-white"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            YT
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlatform(item.id, "tiktok")}
                            title={
                              currentPlatforms.includes("tiktok")
                                ? "TikTok Aktif (klik untuk matikan)"
                                : "TikTok Nonaktif (klik untuk aktifkan)"
                            }
                            className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-black transition-colors ${
                              currentPlatforms.includes("tiktok")
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            TT
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlatform(item.id, "instagram")}
                            title={
                              currentPlatforms.includes("instagram")
                                ? "Instagram Aktif (klik untuk matikan)"
                                : "Instagram Nonaktif (klik untuk aktifkan)"
                            }
                            className={`flex h-6 w-6 items-center justify-center rounded-md text-[9px] font-black transition-colors ${
                              currentPlatforms.includes("instagram")
                                ? "bg-gradient-to-tr from-amber-500 to-purple-600 text-white"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            IG
                          </button>
                        </div>
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-3.5 px-4 align-top">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                            ● Published
                          </span>
                        ) : isReady ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            ● Siap Publish
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                            ● Draft
                          </span>
                        )}
                      </td>

                      {/* 6. Action Triggers */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Copy AI Modal Button */}
                          <button
                            type="button"
                            onClick={() => setEditingContent(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                            title="Buka AI Copy Editor untuk menyesuaikan caption TikTok, YouTube, Instagram"
                          >
                            <Sparkles className="h-3 w-3 text-indigo-600" />
                            <span>Copy AI</span>
                          </button>

                          {/* When video not ready: direct assembly trigger button */}
                          {!isReady ? (
                            <button
                              type="button"
                              disabled={isAssembling}
                              onClick={() => handleAssembleSingle(item.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-600 transition-colors"
                              title="Jalankan perakitan video otomatis jika klip adegan sudah lengkap"
                            >
                              <Sparkles
                                className={`h-3 w-3 ${
                                  isAssembling ? "animate-spin" : ""
                                }`}
                              />
                              <span>
                                {isAssembling
                                  ? "Merakit..."
                                  : "🔨 Rakit Video"}
                              </span>
                            </button>
                          ) : (
                            <>
                              {/* Instant Publish Button */}
                              <button
                                type="button"
                                disabled={isPublishing}
                                onClick={() =>
                                  handlePublish(item, { publishNow: true })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-amber-700 disabled:opacity-40 transition-colors"
                                title="Upload dan tayangkan sekarang juga ke 3 medsos via Buffer"
                              >
                                <Send
                                  className={`h-3 w-3 ${
                                    isPublishingNow ? "animate-spin" : ""
                                  }`}
                                />
                                <span>
                                  {isPublishingNow ? "Mengunggah..." : "⚡ Sekarang"}
                                </span>
                              </button>

                              {/* Scheduled Publish Trigger */}
                              <button
                                type="button"
                                disabled={isPublishing}
                                onClick={() =>
                                  handlePublish(item, { publishNow: false })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                title={`Jadwalkan ke Buffer sesuai waktu yang ditentukan (${scheduleInfo.timeLabel})`}
                              >
                                <Calendar
                                  className={`h-3 w-3 text-indigo-200 ${
                                    isPublishingSchedule ? "animate-spin" : ""
                                  }`}
                                />
                                <span>
                                  {isPublishingSchedule ? "Menjadwalkan..." : "Jadwalkan"}
                                </span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Realistic Social Media Mockup Video Preview Modal */}
      {previewContent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4 backdrop-blur-md animate-in fade-in overflow-y-auto"
        >
          <div className="relative w-full max-w-5xl rounded-3xl border border-slate-700/60 bg-slate-900 text-white shadow-2xl overflow-hidden my-auto">
            {/* Modal Top Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded-md">
                    {previewContent.contentCode}
                  </span>
                  <h3 className="text-base font-black text-white truncate max-w-md">
                    {previewContent.title}
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  File Master: {getSafeFinalFilename(previewContent.title)}
                </p>
              </div>

              {/* Platform Switcher Tabs & Close */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("tiktok")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      previewPlatform === "tiktok"
                        ? "bg-slate-950 text-white shadow-sm border border-slate-700"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-cyan-400 font-black text-xs">TT</span>
                    <span>TikTok</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("instagram")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      previewPlatform === "instagram"
                        ? "bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-purple-500/20 text-white border border-rose-500/40 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-rose-400 font-black text-xs">IG</span>
                    <span>Reels</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewPlatform("youtube")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                      previewPlatform === "youtube"
                        ? "bg-rose-950/80 text-rose-300 border border-rose-800 shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <span className="text-rose-500 font-black text-xs">YT</span>
                    <span>Shorts</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewContent(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-center">
              {/* Left Column: Authentic Smartphone Mockup */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-[280px] sm:w-[310px] aspect-9/16 rounded-[44px] bg-slate-950 p-2.5 shadow-2xl border-[6px] border-slate-800 select-none overflow-hidden">
                  {/* Dynamic Island / Top Notch */}
                  <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-40 h-4 w-20 rounded-full bg-black/90 border border-slate-800 flex items-center justify-end px-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  </div>

                  {/* Audio Mute/Unmute toggle button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMute();
                    }}
                    className="absolute top-4 left-4 z-40 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-md px-2 py-1 text-[10px] font-bold text-white hover:bg-black/80 transition-colors shadow-sm"
                  >
                    {isMuted ? (
                      <VolumeX className="h-3 w-3 text-rose-400" />
                    ) : (
                      <Volume2 className="h-3 w-3 text-emerald-400" />
                    )}
                    <span>{isMuted ? "Bisu" : "Suara"}</span>
                  </button>

                  {/* Screen Content Wrapper */}
                  <div
                    onClick={togglePlay}
                    className="relative w-full h-full rounded-[34px] overflow-hidden bg-black flex flex-col justify-between cursor-pointer"
                  >
                    {/* The Master Video Player */}
                    <video
                      ref={videoRef}
                      loop
                      autoPlay
                      playsInline
                      muted={isMuted}
                      src={`/api/assembly?contentId=${encodeURIComponent(
                        previewContent.id
                      )}&download=1`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Centered Play icon when paused */}
                    {!isPlaying && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 backdrop-blur-md text-white border border-white/20 shadow-lg">
                          <Play className="h-7 w-7 ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Top Platform Overlay Header */}
                    <div className="relative z-20 pt-8 px-4 flex items-center justify-between text-white text-xs">
                      {previewPlatform === "tiktok" && (
                        <div className="w-full flex items-center justify-between">
                          <span className="text-[10px] text-white/50">LIVE</span>
                          <div className="flex items-center gap-3 font-bold text-[11px]">
                            <span className="text-white/60">Mengikuti</span>
                            <span className="text-white border-b-2 border-white pb-0.5">
                              Untuk Anda
                            </span>
                          </div>
                          <Search className="h-4 w-4 text-white" />
                        </div>
                      )}

                      {previewPlatform === "instagram" && (
                        <div className="w-full flex items-center justify-between">
                          <span className="font-black text-sm tracking-tight text-white flex items-center gap-1">
                            Reels <ChevronDown className="h-3 w-3" />
                          </span>
                          <Video className="h-4 w-4 text-white" />
                        </div>
                      )}

                      {previewPlatform === "youtube" && (
                        <div className="w-full flex items-center justify-between">
                          <div className="flex items-center gap-1 font-bold text-xs text-white">
                            <span className="bg-rose-600 px-1.5 py-0.5 rounded text-[9px] font-black">
                              Shorts
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Search className="h-4 w-4 text-white" />
                            <span className="font-bold text-xs">•••</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right-Side Floating Action Stack & Bottom Info */}
                    <div className="relative z-20 flex flex-col justify-end h-full">
                      <div className="flex items-end justify-between px-3 pb-3 pt-12 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                        {/* Bottom Left: Handle, Title & Caption */}
                        <div className="min-w-0 flex-1 pr-3 space-y-1.5">
                          {/* Profile Tag */}
                          {previewPlatform === "tiktok" && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white drop-shadow">
                                @cerita_obim
                              </span>
                              <span className="text-[9px] bg-slate-800 text-slate-300 px-1 rounded">
                                Kreator
                              </span>
                            </div>
                          )}

                          {previewPlatform === "instagram" && (
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-full border border-rose-500 bg-amber-100 flex items-center justify-center text-[9px] font-black text-amber-900">
                                O
                              </div>
                              <span className="font-bold text-xs text-white drop-shadow">
                                @cerita_obim
                              </span>
                              <span className="border border-white/70 px-2 py-0.5 rounded-full text-[9px] font-bold text-white">
                                Ikuti
                              </span>
                            </div>
                          )}

                          {previewPlatform === "youtube" && (
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-full bg-rose-600 flex items-center justify-center text-[9px] font-black text-white">
                                O
                              </div>
                              <span className="font-bold text-xs text-white drop-shadow">
                                @obim
                              </span>
                              <span className="bg-white text-black px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs">
                                Subscribe
                              </span>
                            </div>
                          )}

                          {/* Dynamic Caption Box */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsCaptionExpanded((p) => !p);
                            }}
                            className="cursor-pointer"
                          >
                            <p
                              className={`text-[11px] text-white/95 leading-relaxed drop-shadow ${
                                isCaptionExpanded ? "" : "line-clamp-2"
                              }`}
                            >
                              {getPlatformCopy(previewContent, previewPlatform)}
                            </p>
                            <span className="text-[9px] text-slate-300 font-semibold hover:underline">
                              {isCaptionExpanded
                                ? "Sembunyikan"
                                : "...selengkapnya"}
                            </span>
                          </div>

                          {/* Audio Ticker */}
                          <div className="flex items-center gap-1.5 text-[10px] text-white/80">
                            <Music className="h-3 w-3 shrink-0 animate-pulse text-indigo-300" />
                            <span className="truncate">
                              {previewPlatform === "youtube"
                                ? "Suara Asli Obim • Original Audio"
                                : previewPlatform === "instagram"
                                ? "CeritaObim • Audio Asli"
                                : "Suara Asli - CeritaObim • Origami Stopmotion"}
                            </span>
                          </div>
                        </div>

                        {/* Right-Side Action Icons */}
                        <div className="shrink-0 flex flex-col items-center gap-3 pb-1 text-white text-center">
                          {previewPlatform === "tiktok" && (
                            <>
                              <div className="relative mb-1">
                                <div className="h-8 w-8 rounded-full border border-white bg-amber-100 flex items-center justify-center text-xs font-black text-amber-900 shadow-md">
                                  O
                                </div>
                                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                                  +
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Heart className="h-6 w-6 text-rose-500 fill-rose-500 drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  48.2K
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <MessageCircle className="h-6 w-6 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  342
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Bookmark className="h-6 w-6 text-amber-400 fill-amber-400 drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  1.4K
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Share2 className="h-6 w-6 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  890
                                </span>
                              </div>
                              <div className="mt-1 h-7 w-7 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center animate-[spin_4s_linear_infinite]">
                                <Disc className="h-4 w-4 text-slate-300" />
                              </div>
                            </>
                          )}

                          {previewPlatform === "instagram" && (
                            <>
                              <div className="flex flex-col items-center">
                                <Heart className="h-6 w-6 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  32.1K
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <MessageCircle className="h-6 w-6 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  188
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Send className="h-5 w-5 text-white -rotate-12 drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  450
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Bookmark className="h-5 w-5 text-white drop-shadow" />
                              </div>
                              <div className="text-white text-xs font-black">
                                •••
                              </div>
                              <div className="h-6 w-6 rounded-md border border-white/60 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-xs" />
                            </>
                          )}

                          {previewPlatform === "youtube" && (
                            <>
                              <div className="flex flex-col items-center">
                                <ThumbsUp className="h-5 w-5 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  19K
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <ThumbsDown className="h-5 w-5 text-white drop-shadow" />
                                <span className="text-[8px] font-bold mt-0.5">
                                  Dislike
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <MessageCircle className="h-5 w-5 text-white drop-shadow" />
                                <span className="text-[9px] font-bold mt-0.5">
                                  210
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Share2 className="h-5 w-5 text-white drop-shadow" />
                                <span className="text-[8px] font-bold mt-0.5">
                                  Bagikan
                                </span>
                              </div>
                              <div className="flex flex-col items-center">
                                <Disc className="h-5 w-5 text-white drop-shadow" />
                                <span className="text-[8px] font-bold mt-0.5">
                                  Remix
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Platform Metadata & Publisher Actions */}
              <div className="lg:col-span-7 space-y-4">
                {/* Platform Badge & Character Info */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                          previewPlatform === "tiktok"
                            ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                            : previewPlatform === "instagram"
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : "bg-red-950 text-red-300 border border-red-800"
                        }`}
                      >
                        {previewPlatform === "tiktok"
                          ? "TikTok Feed (@cerita_obim)"
                          : previewPlatform === "instagram"
                          ? "Instagram Reels (@cerita_obim)"
                          : "YouTube Shorts (@obim)"}
                      </span>
                      <span className="text-xs text-slate-400">
                        Pratinjau Nyata Medsos
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyCaption(
                          getPlatformCopy(previewContent, previewPlatform),
                          previewPlatform
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      {copiedPlatform === previewPlatform ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Salin Teks</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Caption & Description Box */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {getPlatformCopy(previewContent, previewPlatform)}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>
                      Panjang Teks:{" "}
                      <strong>
                        {
                          getPlatformCopy(previewContent, previewPlatform)
                            .length
                        }
                      </strong>{" "}
                      karakter
                    </span>
                    <span>
                      Jadwal Target:{" "}
                      <strong className="text-indigo-400">
                        {
                          formatPublishSchedule(
                            previewContent.scheduledPublishAt
                          ).formattedDateTime
                        }
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Metadata & Actions Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                        File Video Master
                      </p>
                      <p className="font-mono text-xs font-bold text-indigo-400 truncate mt-0.5">
                        {getSafeFinalFilename(previewContent.title)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">
                        Resolusi &amp; Rasio
                      </p>
                      <p className="font-bold text-emerald-400 text-xs mt-0.5">
                        1080 x 1920 (9:16 Vertikal)
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/assembly?contentId=${encodeURIComponent(
                          previewContent.id
                        )}&download=1`}
                        download={getSafeFinalFilename(previewContent.title)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh File Master</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const target = previewContent;
                          setPreviewContent(null);
                          setEditingContent(target);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-700/80 bg-indigo-950/70 px-3.5 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-900 transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Edit Copy (AI Studio)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={Boolean(previewContent && publishingMap[previewContent.id])}
                        onClick={() => {
                          handlePublish(previewContent, { publishNow: true });
                          setPreviewContent(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-sm"
                      >
                        <Send className={`h-3.5 w-3.5 ${previewContent && publishingMap[previewContent.id] === "now" ? "animate-spin" : ""}`} />
                        <span>{previewContent && publishingMap[previewContent.id] === "now" ? "Mengunggah..." : "⚡ Publish Sekarang"}</span>
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(previewContent && publishingMap[previewContent.id])}
                        onClick={() => {
                          handlePublish(previewContent, { publishNow: false });
                          setPreviewContent(null);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                      >
                        <Calendar className={`h-3.5 w-3.5 ${previewContent && publishingMap[previewContent.id] === "schedule" ? "animate-spin" : ""}`} />
                        <span>{previewContent && publishingMap[previewContent.id] === "schedule" ? "Menjadwalkan..." : "📅 Jadwalkan ke Buffer"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Interactive AI Social Copy Studio Modal */}
      {editingContent && (
        <SocialCopyEditorModal
          content={editingContent}
          isOpen={Boolean(editingContent)}
          onClose={() => setEditingContent(null)}
          onSaved={(updated) => {
            setItems((prev) =>
              prev.map((it) =>
                it.id === editingContent.id ? { ...it, ...updated } : it
              )
            );
          }}
        />
      )}
    </div>
  );
}
