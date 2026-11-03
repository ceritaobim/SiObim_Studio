"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Film,
  Mic,
  Calendar,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Send,
  ExternalLink,
} from "lucide-react";
import type {
  ContentItemRecord,
  SceneRecord,
  AssetRecord,
  PlatformPublicationRecord,
} from "@/types/domain";

interface DashboardProgressTableProps {
  items: ContentItemRecord[];
  allAssets: AssetRecord[];
  scenesByContent: Record<string, SceneRecord[]>;
  allPublications: PlatformPublicationRecord[];
}

type PublishState = "Production" | "Waiting" | "Scheduled" | "Published";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
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

/**
 * Format jadwal persis sesuai contoh user: "Selasa, 3 Nov 26"
 */
function formatJadwalUserStyle(dateStr?: string | null, fallbackIndex: number = 0): string {
  let d: Date;
  if (dateStr) {
    d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      d = new Date();
    }
  } else {
    // Estimasi urutan jadwal (1 video per hari mulai 3 Nov 2026)
    const base = new Date("2026-11-03T18:00:00+07:00");
    base.setDate(base.getDate() + fallbackIndex);
    d = base;
  }

  // Konversi ke UTC+7 (WIB)
  const utcMs = d.getTime();
  const wibMs = utcMs + 7 * 60 * 60 * 1000;
  const wib = new Date(wibMs);

  const day = DAY_NAMES[wib.getUTCDay()];
  const dateNum = wib.getUTCDate();
  const month = MONTH_NAMES[wib.getUTCMonth()];
  const year2Digit = String(wib.getUTCFullYear()).slice(-2);

  return `${day}, ${dateNum} ${month} ${year2Digit}`;
}

export function DashboardProgressTable({
  items,
  allAssets,
  scenesByContent,
  allPublications,
}: DashboardProgressTableProps) {
  const [selectedWeek, setSelectedWeek] = useState<number | "all">("all");
  const [selectedProgram, setSelectedProgram] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Map publikasi untuk pencarian cepat (contentId + platform)
  const pubMap = useMemo(() => {
    const map = new Map<string, PlatformPublicationRecord>();
    for (const pub of allPublications) {
      map.set(`${pub.contentId}_${pub.platform.toLowerCase()}`, pub);
    }
    return map;
  }, [allPublications]);

  // Map audio asset per contentId
  const audioMap = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAssets) {
      if (a.assetType === "voice_audio" && a.contentId) {
        set.add(a.contentId);
      }
    }
    return set;
  }, [allAssets]);

  // Map final video asset per contentId
  const finalVideoMap = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAssets) {
      if (a.assetType === "final_video" && a.contentId) {
        set.add(a.contentId);
      }
    }
    return set;
  }, [allAssets]);

  // Klip per adegan
  const clipCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const scList = scenesByContent[item.id] ?? [];
      const itemAssets = allAssets.filter((a) => a.contentId === item.id);
      let count = 0;
      for (const sc of scList) {
        const hasClip = itemAssets.some(
          (a) =>
            a.assetType === "scene_video" &&
            (a.sceneId === sc.id || a.id === sc.uploadedClipAssetId)
        );
        if (hasClip) count++;
      }
      map.set(item.id, count);
    }
    return map;
  }, [items, scenesByContent, allAssets]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item, index) => {
      // 1. Filter Week (1 week = 7 konten)
      if (selectedWeek !== "all") {
        const itemWeek = Math.floor(index / 7) + 1;
        if (itemWeek !== selectedWeek) return false;
      }

      // 2. Filter Segmen
      if (selectedProgram !== "all") {
        const prog = item.programName || item.category || "";
        if (selectedProgram === "Ke Dapur Yuk!" && !prog.includes("Dapur")) return false;
        if (selectedProgram === "Kepikiran Aja" && !prog.includes("Kepikiran") && !prog.includes("Mau Tau")) return false;
        if (selectedProgram === "Eh, Ternyata!" && !prog.includes("Ternyata")) return false;
      }

      // 3. Search Title / Code
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesCode = item.contentCode.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode) return false;
      }

      return true;
    });
  }, [items, selectedWeek, selectedProgram, searchQuery]);

  // Helper status publish
  const getPublishState = (
    item: ContentItemRecord,
    platform: "youtube" | "instagram" | "tiktok",
    isVideoComplete: boolean
  ): PublishState => {
    const pub = pubMap.get(`${item.id}_${platform}`);

    // 1. Published jika status di publikasi published atau content status published
    if (pub?.publishStatus === "published" || item.contentStatus === "published" || item.publishedAt) {
      return "Published";
    }

    // 2. Scheduled jika ada jadwal publikasi di Buffer
    if (pub?.publishStatus === "scheduled" || (pub?.scheduledAt && new Date(pub.scheduledAt).getTime() > Date.now())) {
      return "Scheduled";
    }

    // 3. Waiting jika video sudah selesai diproduksi (3/3 klip atau ada final video)
    if (isVideoComplete) {
      return "Waiting";
    }

    // 4. Production jika belum selesai diproduksi
    return "Production";
  };

  const renderPublishBadge = (state: PublishState) => {
    switch (state) {
      case "Published":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            Published
          </span>
        );
      case "Scheduled":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-300">
            <Clock className="h-3 w-3 text-indigo-600" />
            Scheduled
          </span>
        );
      case "Waiting":
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-300">
            Waiting
          </span>
        );
      case "Production":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800 border border-rose-300">
            Production
          </span>
        );
    }
  };

  // Hitung metrik keseluruhan
  const totalAudioCount = items.filter((i) => audioMap.has(i.id)).length;
  const totalVideoCompleteCount = items.filter((i) => {
    const totalScenes = (scenesByContent[i.id] ?? []).length || 3;
    const clips = clipCountMap.get(i.id) || 0;
    return finalVideoMap.has(i.id) || clips >= totalScenes;
  }).length;
  const totalPublishedCount = items.filter(
    (i) => i.contentStatus === "published" || Boolean(i.publishedAt)
  ).length;

  return (
    <div className="rounded-3xl border border-indigo-100 bg-white shadow-xs overflow-hidden">
      {/* 1. HEADER & KPI QUICK STRIP */}
      <div className="p-5 sm:p-6 border-b border-indigo-50 bg-gradient-to-r from-white via-indigo-50/20 to-purple-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                📊
              </span>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Master Progress Studio Konten
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pantau jadwal, segmen acara, status voice over, perakitan video, dan jadwal publish Shorts, Reels, &amp; TikTok.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-center shadow-2xs">
              <span className="block text-[10px] font-bold text-slate-600 uppercase">Total Konten</span>
              <span className="text-sm font-black text-slate-900">{items.length}</span>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-center shadow-2xs">
              <span className="block text-[10px] font-bold text-emerald-800 uppercase">Audio Siap</span>
              <span className="text-sm font-black text-emerald-800">{totalAudioCount}/{items.length}</span>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-1.5 text-center shadow-2xs">
              <span className="block text-[10px] font-bold text-indigo-800 uppercase">Video Siap</span>
              <span className="text-sm font-black text-indigo-800">{totalVideoCompleteCount}/{items.length}</span>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-1.5 text-center shadow-2xs">
              <span className="block text-[10px] font-bold text-purple-800 uppercase">Live / Terjadwal</span>
              <span className="text-sm font-black text-purple-800">{totalPublishedCount}</span>
            </div>
          </div>
        </div>

        {/* 2. FILTER CONTROLS: WEEK TABS, SEGMENT PILLS & SEARCH */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Week Selection Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600 mr-1">Pekan:</span>
            <button
              onClick={() => setSelectedWeek("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                selectedWeek === "all"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua ({items.length})
            </button>
            {[1, 2, 3, 4, 5, 6].map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWeek(w)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                  selectedWeek === w
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                Week {w}
              </button>
            ))}
          </div>

          {/* Segment Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => setSelectedProgram("all")}
                className={`rounded-lg px-2.5 py-0.5 font-bold transition-colors ${
                  selectedProgram === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setSelectedProgram("Ke Dapur Yuk!")}
                className={`rounded-lg px-2 py-0.5 font-bold transition-colors ${
                  selectedProgram === "Ke Dapur Yuk!"
                    ? "bg-amber-100 text-amber-900 shadow-2xs"
                    : "text-amber-800 hover:bg-amber-50"
                }`}
              >
                🍳 Dapur
              </button>
              <button
                onClick={() => setSelectedProgram("Kepikiran Aja")}
                className={`rounded-lg px-2 py-0.5 font-bold transition-colors ${
                  selectedProgram === "Kepikiran Aja"
                    ? "bg-indigo-100 text-indigo-900 shadow-2xs"
                    : "text-indigo-800 hover:bg-indigo-50"
                }`}
              >
                🌙 Pikiran
              </button>
              <button
                onClick={() => setSelectedProgram("Eh, Ternyata!")}
                className={`rounded-lg px-2 py-0.5 font-bold transition-colors ${
                  selectedProgram === "Eh, Ternyata!"
                    ? "bg-emerald-100 text-emerald-900 shadow-2xs"
                    : "text-emerald-800 hover:bg-emerald-50"
                }`}
              >
                💡 Fakta
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari judul..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. TABLE BODY (EXACT COLUMNS REQUESTED BY USER) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Jadwal</th>
              <th className="py-3 px-4 whitespace-nowrap min-w-[130px]">Segmen</th>
              <th className="py-3 px-4 min-w-[240px]">Judul Konten</th>
              <th className="py-3 px-4 text-center whitespace-nowrap min-w-[90px]">Audio</th>
              <th className="py-3 px-4 text-center whitespace-nowrap min-w-[90px]">Video</th>
              <th className="py-3 px-4 text-center whitespace-nowrap min-w-[105px]">Shorts</th>
              <th className="py-3 px-4 text-center whitespace-nowrap min-w-[105px]">Reels</th>
              <th className="py-3 px-4 text-center whitespace-nowrap min-w-[105px]">TikTok</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  Tidak ada konten yang sesuai dengan filter atau kata kunci.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const scList = scenesByContent[item.id] ?? [];
                const totalScenes = scList.length || 3;
                const clipsDone = clipCountMap.get(item.id) || 0;
                const hasFinalVideo = finalVideoMap.has(item.id);
                const hasVoiceAudio = audioMap.has(item.id);

                // Video count logic
                const videoRatioDone = hasFinalVideo ? totalScenes : clipsDone;
                const isVideoComplete = hasFinalVideo || videoRatioDone >= totalScenes;

                // Video color formatting
                let videoBadgeClass = "bg-rose-50 text-rose-700 border-rose-200"; // 0/3
                if (videoRatioDone > 0 && videoRatioDone < totalScenes) {
                  videoBadgeClass = "bg-amber-50 text-amber-800 border-amber-200"; // 1/3, 2/3
                } else if (videoRatioDone >= totalScenes) {
                  videoBadgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200"; // 3/3
                }

                // Segmen badge formatting
                const segmenName = item.programName || item.category || "Eh, Ternyata!";
                let segmenBadgeClass = "border-emerald-200 bg-emerald-50 text-emerald-800";
                let segmenIcon = "💡";

                if (segmenName.includes("Dapur")) {
                  segmenBadgeClass = "border-amber-200 bg-amber-50 text-amber-800";
                  segmenIcon = "🍳";
                } else if (segmenName.includes("Kepikiran") || segmenName.includes("Mau Tau")) {
                  segmenBadgeClass = "border-indigo-200 bg-indigo-50 text-indigo-800";
                  segmenIcon = "🌙";
                }

                // Jadwal formatted: "Selasa, 3 Nov 26"
                const itemDateStr = item.publishedAt || item.scheduledPublishAt;
                const jadwalText = formatJadwalUserStyle(itemDateStr, idx);

                // Status publish per channel
                const shortsState = getPublishState(item, "youtube", isVideoComplete);
                const reelsState = getPublishState(item, "instagram", isVideoComplete);
                const tiktokState = getPublishState(item, "tiktok", isVideoComplete);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    {/* 1. JADWAL */}
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{jadwalText}</span>
                      </div>
                    </td>

                    {/* 2. SEGMEN (sebelum judul) */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${segmenBadgeClass}`}
                      >
                        <span>{segmenIcon}</span>
                        <span>{segmenName}</span>
                      </span>
                    </td>

                    {/* 3. JUDUL KONTEN */}
                    <td className="py-3 px-4 max-w-sm">
                      <Link
                        href={`/assets`}
                        className="font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 transition-colors"
                      >
                        {item.title}
                      </Link>
                    </td>

                    {/* 4. AUDIO (Ceklis / Sudah / Belum format warna) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {hasVoiceAudio ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Sudah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                          <XCircle className="h-3 w-3 text-rose-500" />
                          Belum
                        </span>
                      )}
                    </td>

                    {/* 5. VIDEO (Format X/Y klip e.g. 0/3, 1/3, 3/3 dengan format warna) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-mono font-black ${videoBadgeClass}`}
                      >
                        {videoRatioDone}/{totalScenes}
                      </span>
                    </td>

                    {/* 6. SHORTS */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {renderPublishBadge(shortsState)}
                    </td>

                    {/* 7. REELS */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {renderPublishBadge(reelsState)}
                    </td>

                    {/* 8. TIKTOK */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {renderPublishBadge(tiktokState)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* TABLE FOOTER */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
        <span>Menampilkan <b>{filteredItems.length}</b> dari {items.length} konten</span>
        <div className="flex items-center gap-4">
          <Link
            href="/assets"
            className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>Buka Video Studio</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/publishing"
            className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>Buka Buffer Publisher</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
