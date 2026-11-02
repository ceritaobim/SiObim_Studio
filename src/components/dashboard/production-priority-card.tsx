"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  AlertCircle,
  ArrowRight,
  Play,
  Mic,
  Film,
  Send,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import type { AssetRecord, ContentItemRecord, SceneRecord } from "@/types/domain";

interface ProductionPriorityCardProps {
  items: ContentItemRecord[];
  allAssets: AssetRecord[];
  scenesByContent: Record<string, SceneRecord[]>;
}

interface PriorityItemEvaluation {
  item: ContentItemRecord;
  stage: "needs_audio" | "needs_clips" | "needs_assembly" | "ready_to_publish" | "published";
  stageLabel: string;
  stageDescription: string;
  actionLabel: string;
  actionHref: string;
  actionIcon: "mic" | "film" | "play" | "send";
  completedClips: number;
  totalClips: number;
  hasAudio: boolean;
  hasFinalVideo: boolean;
  scheduledTime: Date | null;
  msUntilSchedule: number | null;
}

export function ProductionPriorityCard({
  items,
  allAssets,
  scenesByContent,
}: ProductionPriorityCardProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Evaluate all items to determine their production stage and schedule
  const evaluations: PriorityItemEvaluation[] = items.map((item) => {
    const hasAudio = allAssets.some(
      (a) => a.contentId === item.id && a.assetType === "voice_audio"
    );
    const hasFinalVideo = allAssets.some(
      (a) => a.contentId === item.id && a.assetType === "final_video"
    );

    const scenes = scenesByContent[item.id] || [];
    const itemAssets = allAssets.filter((a) => a.contentId === item.id);
    let completedClips = 0;
    for (const sc of scenes) {
      const clipFound = itemAssets.some(
        (a) =>
          a.assetType === "scene_video" &&
          (a.sceneId === sc.id || a.id === sc.uploadedClipAssetId)
      );
      if (clipFound) completedClips++;
    }

    const scheduledTime = item.scheduledPublishAt
      ? new Date(item.scheduledPublishAt)
      : null;
    const msUntilSchedule = scheduledTime
      ? scheduledTime.getTime() - now.getTime()
      : null;

    let stage: PriorityItemEvaluation["stage"] = "needs_audio";
    let stageLabel = "1. Butuh Voice Over";
    let stageDescription = "Audio narasi ElevenLabs belum digenerate.";
    let actionLabel = "Generate Voice Over";
    let actionHref = "/production";
    let actionIcon: PriorityItemEvaluation["actionIcon"] = "mic";

    if (item.contentStatus === "published" || item.publishedAt?.includes("Published")) {
      stage = "published";
      stageLabel = "Sudah Tayang";
      stageDescription = "Video sudah dipublish ke media sosial.";
      actionLabel = "Lihat Analitik";
      actionHref = "/analytics";
      actionIcon = "send";
    } else if (hasFinalVideo) {
      stage = "ready_to_publish";
      stageLabel = "Siap Tayang ke Buffer";
      stageDescription = "Video master 00Final.mp4 siap dijadwalkan ke 3 platform.";
      actionLabel = "Publish via Buffer";
      actionHref = "/publishing";
      actionIcon = "send";
    } else if (scenes.length > 0 && completedClips >= scenes.length) {
      stage = "needs_assembly";
      stageLabel = "Siap Rakit Final";
      stageDescription = `Semua ${completedClips}/${scenes.length} klip scene origami lengkap. Siap assembly 00Final.mp4.`;
      actionLabel = "Rakit Video Final";
      actionHref = "/assets";
      actionIcon = "play";
    } else if (hasAudio) {
      stage = "needs_clips";
      stageLabel = "Produksi Klip Origami";
      stageDescription = `Klip visual terisi ${completedClips}/${scenes.length || 8} scene. Butuh generate sisa klip.`;
      actionLabel = "Buka Video Studio";
      actionHref = "/assets";
      actionIcon = "film";
    }

    return {
      item,
      stage,
      stageLabel,
      stageDescription,
      actionLabel,
      actionHref,
      actionIcon,
      completedClips,
      totalClips: scenes.length || 8,
      hasAudio,
      hasFinalVideo,
      scheduledTime,
      msUntilSchedule,
    };
  });

  // Filter out already published items for active production priority
  const activeEvaluations = evaluations.filter((e) => e.stage !== "published");

  // Priority sorting:
  // 1. Items with upcoming schedule (closest to now or overdue)
  // 2. Fallback to items in progress
  const sortedPriority = [...activeEvaluations].sort((a, b) => {
    if (a.msUntilSchedule !== null && b.msUntilSchedule !== null) {
      return a.msUntilSchedule - b.msUntilSchedule;
    }
    if (a.msUntilSchedule !== null) return -1;
    if (b.msUntilSchedule !== null) return 1;
    return a.item.contentCode.localeCompare(b.item.contentCode);
  });

  const topPriority = sortedPriority[0] || evaluations[0];
  const nextQueues = sortedPriority.slice(1, 3);

  // Format countdown string
  const formatCountdown = (ms: number | null) => {
    if (ms === null) {
      return {
        isOverdue: false,
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        formatted: "Belum Ada Jadwal",
      };
    }

    const isOverdue = ms <= 0;
    const absMs = Math.abs(ms);
    const totalSeconds = Math.floor(absMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      isOverdue,
      days,
      hours,
      minutes,
      seconds,
      formatted: `${days > 0 ? `${days}h ` : ""}${String(hours).padStart(
        2,
        "0"
      )}j ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(
        2,
        "0"
      )}d`,
    };
  };

  const countdown = formatCountdown(topPriority?.msUntilSchedule ?? null);

  const formatScheduledDateString = (date: Date | null) => {
    if (!date) return "Jadwal belum diset";
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date) + " WIB";
  };

  if (!topPriority) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xs">
        <Sparkles className="mx-auto h-8 w-8 text-amber-500" />
        <h3 className="mt-2 text-base font-bold text-slate-900">
          Semua Video Telah Selesai Diproduksi!
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Buat content plan baru di menu Content Planning untuk memulai batch berikutnya.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-300/80 bg-gradient-to-br from-amber-500/10 via-white to-amber-50/40 p-6 sm:p-7 shadow-sm">
      {/* Glow highlight */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-32 h-44 w-44 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 space-y-5">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-amber-900">
              Prioritas Utama Produksi Sekarang
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              Target Tayang Berikutnya
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-amber-700" />
            <span>{formatScheduledDateString(topPriority.scheduledTime)}</span>
          </div>
        </div>

        {/* Main Priority Content & Live Countdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          {/* Left Column: Video Info & Stage Progress (7 cols) */}
          <div className="space-y-3.5 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-stone-900 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-2xs">
                {topPriority.item.contentCode}
              </span>
              <span className="rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-bold text-amber-900">
                {topPriority.item.programName || "Sains & Fakta Unik"}
              </span>
              <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                Durasi Target: {topPriority.item.targetDurationSeconds}s
              </span>
            </div>

            <div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                {topPriority.item.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600 leading-relaxed">
                {topPriority.item.hook || topPriority.item.tiktokCaption}
              </p>
            </div>

            {/* Pipeline Stage Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  Status: {topPriority.stageLabel}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {topPriority.completedClips}/{topPriority.totalClips} Klip Selesai
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {topPriority.stageDescription}
              </p>

              {/* Progress 4-steps pills */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-center text-[10px] font-bold">
                <div className="rounded-lg bg-emerald-100 text-emerald-800 py-1 border border-emerald-200">
                  1. Riset & Hook ✓
                </div>
                <div
                  className={`rounded-lg py-1 border ${
                    topPriority.hasAudio
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : "bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse"
                  }`}
                >
                  2. Voice Over {topPriority.hasAudio ? "✓" : "⚡"}
                </div>
                <div
                  className={`rounded-lg py-1 border ${
                    topPriority.completedClips >= topPriority.totalClips
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : topPriority.hasAudio
                      ? "bg-amber-100 text-amber-900 border-amber-300 font-black animate-pulse"
                      : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}
                >
                  3. Klip Video ({topPriority.completedClips}/{topPriority.totalClips})
                </div>
                <div
                  className={`rounded-lg py-1 border ${
                    topPriority.hasFinalVideo
                      ? "bg-indigo-100 text-indigo-900 border-indigo-200 font-black"
                      : "bg-slate-100 text-slate-400 border-slate-200"
                  }`}
                >
                  4. Publish Buffer {topPriority.hasFinalVideo ? "✓" : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Countdown Box & Direct Action Button (5 cols) */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-200/90 bg-white/90 p-5 shadow-2xs backdrop-blur-xs lg:col-span-5">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-amber-900">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Sisa Waktu Hingga Upload
                </span>
                {countdown.isOverdue ? (
                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 animate-pulse">
                    Waktunya Upload!
                  </span>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                    Sesuai Jadwal
                  </span>
                )}
              </div>

              {/* Countdown Numbers */}
              <div className="mt-3 flex items-baseline justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-white shadow-inner">
                {topPriority.msUntilSchedule !== null ? (
                  countdown.isOverdue ? (
                    <div className="text-center py-1">
                      <span className="text-lg font-black text-amber-400">
                        Jadwal Upload Telah Tiba!
                      </span>
                      <p className="text-[10px] text-stone-300 mt-0.5">
                        Segera selesaikan dan publish via Buffer sekarang
                      </p>
                    </div>
                  ) : (
                    <>
                      {countdown.days > 0 ? (
                        <div className="text-center">
                          <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                            {String(countdown.days).padStart(2, "0")}
                          </span>
                          <span className="block text-[9px] font-bold text-stone-400 uppercase">
                            Hari
                          </span>
                        </div>
                      ) : null}
                      {countdown.days > 0 ? (
                        <span className="text-lg font-bold text-stone-500">:</span>
                      ) : null}
                      <div className="text-center">
                        <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                          {String(countdown.hours).padStart(2, "0")}
                        </span>
                        <span className="block text-[9px] font-bold text-stone-400 uppercase">
                          Jam
                        </span>
                      </div>
                      <span className="text-lg font-bold text-stone-500">:</span>
                      <div className="text-center">
                        <span className="font-mono text-2xl sm:text-3xl font-black text-white">
                          {String(countdown.minutes).padStart(2, "0")}
                        </span>
                        <span className="block text-[9px] font-bold text-stone-400 uppercase">
                          Menit
                        </span>
                      </div>
                      <span className="text-lg font-bold text-stone-500">:</span>
                      <div className="text-center">
                        <span className="font-mono text-2xl sm:text-3xl font-black text-amber-400">
                          {String(countdown.seconds).padStart(2, "0")}
                        </span>
                        <span className="block text-[9px] font-bold text-stone-400 uppercase">
                          Detik
                        </span>
                      </div>
                    </>
                  )
                ) : (
                  <span className="text-xs font-bold text-stone-400 py-1">
                    Jadwal belum disetel di Content Planning
                  </span>
                )}
              </div>
            </div>

            {/* Direct CTA Action Button */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <Link
                href={topPriority.actionHref}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all active:scale-[0.98]"
              >
                {topPriority.actionIcon === "mic" ? (
                  <Mic className="h-4 w-4" />
                ) : topPriority.actionIcon === "film" ? (
                  <Film className="h-4 w-4" />
                ) : topPriority.actionIcon === "play" ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Eksekusi: {topPriority.actionLabel}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>

        {/* Next in Queue Quick Peek */}
        {nextQueues.length > 0 ? (
          <div className="border-t border-amber-200/50 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-semibold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              Antrean Berikutnya:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {nextQueues.map((q) => (
                <Link
                  key={q.item.id}
                  href={q.actionHref}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-amber-300 hover:text-amber-900 transition-colors"
                >
                  <span className="font-mono font-bold text-amber-700">
                    {q.item.contentCode}
                  </span>
                  <span className="max-w-[160px] truncate">{q.item.title}</span>
                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500 font-mono">
                    {formatCountdown(q.msUntilSchedule).formatted}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
