"use client";

import { useState, useMemo } from "react";
import {
  Eye,
  Clock,
  Users,
  Sparkles,
  Edit3,
  CheckCircle2,
  AlertCircle,
  X,
  Heart,
  Video,
  Layers,
  Flame,
  Award,
} from "lucide-react";
import type {
  AnalyticsSummary,
  ContentAnalyticsRecord,
  ContentItemRecord,
  PlatformTarget,
} from "@/types/domain";
import { SectionCard } from "@/components/ui/section-card";

interface AnalyticsDashboardManagerProps {
  initialSummary: AnalyticsSummary;
  initialAnalytics: ContentAnalyticsRecord[];
  initialItems: ContentItemRecord[];
}

export function AnalyticsDashboardManager({
  initialSummary,
  initialAnalytics,
  initialItems,
}: AnalyticsDashboardManagerProps) {
  const [summary, setSummary] = useState<AnalyticsSummary>(initialSummary);
  const [analytics, setAnalytics] = useState<ContentAnalyticsRecord[]>(initialAnalytics);
  const [items] = useState<ContentItemRecord[]>(initialItems);

  // Platform Filter
  const [selectedPlatform, setSelectedPlatform] = useState<"all" | PlatformTarget>("all");

  // Quick Edit Modal State
  const [editingContent, setEditingContent] = useState<ContentItemRecord | null>(null);
  const [editForm, setEditForm] = useState<{
    youtube: {
      views: number;
      watchTimeHours: number;
      likes: number;
      subscribersGained: number;
      ctrPercentage: number;
    };
    tiktok: {
      views: number;
      likes: number;
      shares: number;
      saves: number;
      averageWatchTimeSeconds: number;
    };
    instagram: {
      views: number;
      likes: number;
      shares: number;
      saves: number;
      nonFollowerPercentage: number;
    };
  }>({
    youtube: { views: 0, watchTimeHours: 0, likes: 0, subscribersGained: 0, ctrPercentage: 0 },
    tiktok: { views: 0, likes: 0, shares: 0, saves: 0, averageWatchTimeSeconds: 0 },
    instagram: { views: 0, likes: 0, shares: 0, saves: 0, nonFollowerPercentage: 0 },
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Map content id to item
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Combined sorted list
  const enrichedRows = useMemo(() => {
    return analytics
      .map((a) => {
        const item = itemMap.get(a.contentId);
        return {
          ...a,
          contentCode: item?.contentCode ?? "N/A",
          title: item?.title ?? "Tanpa Judul",
          hook: item?.hook ?? "",
          category: item?.category ?? "Umum",
        };
      })
      .filter((row) => {
        if (selectedPlatform === "all") return true;
        if (selectedPlatform === "youtube") return (row.youtube?.views ?? 0) > 0;
        if (selectedPlatform === "tiktok") return (row.tiktok?.views ?? 0) > 0;
        if (selectedPlatform === "instagram") return (row.instagram?.views ?? 0) > 0;
        return true;
      })
      .sort((a, b) => {
        if (selectedPlatform === "youtube") return (b.youtube?.views ?? 0) - (a.youtube?.views ?? 0);
        if (selectedPlatform === "tiktok") return (b.tiktok?.views ?? 0) - (a.tiktok?.views ?? 0);
        if (selectedPlatform === "instagram") return (b.instagram?.views ?? 0) - (a.instagram?.views ?? 0);
        return b.totalViews - a.totalViews;
      });
  }, [analytics, itemMap, selectedPlatform]);

  const handleOpenEdit = (record: ContentAnalyticsRecord) => {
    const item = itemMap.get(record.contentId);
    if (!item) return;

    setEditingContent(item);
    setEditForm({
      youtube: {
        views: record.youtube?.views ?? 0,
        watchTimeHours: record.youtube?.watchTimeHours ?? 0,
        likes: record.youtube?.likes ?? 0,
        subscribersGained: record.youtube?.subscribersGained ?? 0,
        ctrPercentage: record.youtube?.ctrPercentage ?? 0,
      },
      tiktok: {
        views: record.tiktok?.views ?? 0,
        likes: record.tiktok?.likes ?? 0,
        shares: record.tiktok?.shares ?? 0,
        saves: record.tiktok?.saves ?? 0,
        averageWatchTimeSeconds: record.tiktok?.averageWatchTimeSeconds ?? 0,
      },
      instagram: {
        views: record.instagram?.views ?? 0,
        likes: record.instagram?.likes ?? 0,
        shares: record.instagram?.shares ?? 0,
        saves: record.instagram?.saves ?? 0,
        nonFollowerPercentage: record.instagram?.nonFollowerPercentage ?? 0,
      },
    });
    setFeedback(null);
  };

  const handleSaveMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContent) return;

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: editingContent.id,
          youtube: editForm.youtube,
          tiktok: editForm.tiktok,
          instagram: editForm.instagram,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan metrik.");
      }

      // Update state
      setAnalytics((prev) =>
        prev.map((a) => (a.contentId === editingContent.id ? data.updated : a))
      );
      if (data.summary) {
        setSummary(data.summary);
      }

      setFeedback({ type: "success", text: "Metrik analitik berhasil diperbarui!" });
      setTimeout(() => {
        setEditingContent(null);
        setFeedback(null);
      }, 900);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Terjadi kesalahan sistem.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Info & Notification */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">
            Cross-Platform Content Analytics
          </h1>
          <p className="text-xs text-stone-600 sm:text-sm">
            Pantau pertumbuhan tayangan, retensi jam tonton, dan formula hook dari YouTube Shorts, TikTok, & IG Reels.
          </p>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Total Views */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Tayangan</span>
            <Eye className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">
            {summary.totalViews.toLocaleString("id-ID")}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Semua Platform</span>
          </div>
        </div>

        {/* Watch Time */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Waktu Tonton</span>
            <Clock className="h-4 w-4 text-sky-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">
            {summary.totalWatchTimeHours} <span className="text-sm font-normal text-stone-500">Jam</span>
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            <span>YouTube Shorts</span>
          </div>
        </div>

        {/* Audiens Gained */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-medium uppercase tracking-wider">Subscribers</span>
            <Users className="h-4 w-4 text-rose-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-stone-900">
            +{summary.totalSubscribersGained}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            <span>Pelanggan Baru</span>
          </div>
        </div>

        {/* Top Performer */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-medium uppercase tracking-wider">Top Video</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-base font-bold text-emerald-950 truncate" title={summary.topPerformingContent?.title}>
            {summary.topPerformingContent?.contentCode ?? "Belum ada"}
          </p>
          <p className="text-xs text-emerald-700 truncate">
            {summary.topPerformingContent?.totalViews.toLocaleString("id-ID") ?? 0} views ({summary.topPerformingContent?.platform})
          </p>
        </div>
      </div>

      {/* 3. Platform Distribution Bar & AI Insights Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Platform Share Breakdown */}
        <SectionCard
          title="Distribusi Tayangan Platform"
          description="Rasio persebaran audiens penonton Obim di tiga medsos utama."
          className="lg:col-span-1"
        >
          <div className="space-y-4 pt-1">
            {/* YouTube */}
            <div>
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-600" />
                  YouTube Shorts
                </span>
                <span className="font-bold">
                  {summary.totalYoutubeViews.toLocaleString("id-ID")} ({summary.totalViews > 0 ? Math.round((summary.totalYoutubeViews / summary.totalViews) * 100) : 0}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-rose-600 transition-all duration-500"
                  style={{ width: `${summary.totalViews > 0 ? (summary.totalYoutubeViews / summary.totalViews) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* TikTok */}
            <div>
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-stone-900" />
                  TikTok
                </span>
                <span className="font-bold">
                  {summary.totalTiktokViews.toLocaleString("id-ID")} ({summary.totalViews > 0 ? Math.round((summary.totalTiktokViews / summary.totalViews) * 100) : 0}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-stone-900 transition-all duration-500"
                  style={{ width: `${summary.totalViews > 0 ? (summary.totalTiktokViews / summary.totalViews) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Instagram */}
            <div>
              <div className="flex justify-between text-xs font-medium text-stone-700">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-600" />
                  Instagram Reels
                </span>
                <span className="font-bold">
                  {summary.totalInstagramViews.toLocaleString("id-ID")} ({summary.totalViews > 0 ? Math.round((summary.totalInstagramViews / summary.totalViews) * 100) : 0}%)
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-fuchsia-600 transition-all duration-500"
                  style={{ width: `${summary.totalViews > 0 ? (summary.totalInstagramViews / summary.totalViews) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              <span className="font-semibold text-stone-800">Catatan Algoritma:</span> YouTube Shorts menyerap 50%+ jam tonton panjang (65-80s), sementara TikTok & IG unggul pada kecepatan penemuan akun baru (99.8% non-pengikut).
            </div>
          </div>
        </SectionCard>

        {/* AI Winning Formula & Hook Analyzer */}
        <SectionCard
          title="AI Winning Formula & Hook Analyzer"
          description="Pola psikologis dan visual dari video yang terbukti tembus ribuan views."
          badge={
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <Sparkles className="h-3 w-3" /> Rekomendasi Algoritma
            </span>
          }
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Topik Pemenang Terbesar
                </h3>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-stone-800">
                Fakta Tubuh & Mitos Medis Indonesia
              </p>
              <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                Video <em>&apos;Masuk Angin&apos;</em> (1.7k YT / 1.3k IG) & <em>&apos;Tulang Bungkuk&apos;</em> (661 TikTok) membuktikan bahwa audiens langsung berhenti scroll jika merasa fisiknya tersentil.
              </p>
            </div>

            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" />
                <h3 className="text-xs font-bold text-sky-950 uppercase tracking-wide">
                  Magnet Subscriber Baru
                </h3>
              </div>
              <p className="mt-1.5 text-xs font-semibold text-stone-800">
                Pola Tidur & Relatable Work-Life
              </p>
              <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                Video <em>&apos;Siang ngantuk, malam melek&apos;</em> menyumbang <strong>+6 subscriber</strong> sendirian. Topik kecemasan harian paling efektif memancing orang menekan tombol subscribe/follow.
              </p>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5">
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Blueprint Produksi Batch Berikutnya
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-stone-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Hook 0-2 detik:</strong> Hindari nama karakter di awal. Gunakan kata pancingan: <em>&quot;Pernah gak...&quot;</em> atau <em>&quot;Kenapa ya...&quot;</em> yang langsung mengarah ke masalah penonton.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Visual Origami Dinamis:</strong> Pakai panah penunjuk merah origami atau model organ/benda yang bergerak di detik pertama.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span><strong>Bio Profil:</strong> Isi biodata di TikTok dan YouTube dengan positioning yang jelas (e.g. &quot;Fakta tubuh & psikologi unik harian lewat animasi origami&quot;) agar penonton yang mampir langsung follow.</span>
                </li>
              </ul>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 4. Content Performance Matrix Table */}
      <SectionCard
        title="Matriks Performa Konten Harian"
        description="Daftar video yang telah diunggah dengan rincian metrik per platform dan evaluasi algoritma."
        badge={
          <div className="flex items-center gap-1 rounded-lg bg-stone-100 p-1 text-xs font-medium">
            <button
              onClick={() => setSelectedPlatform("all")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedPlatform === "all" ? "bg-white font-bold text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Semua ({analytics.length})
            </button>
            <button
              onClick={() => setSelectedPlatform("youtube")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedPlatform === "youtube" ? "bg-white font-bold text-rose-600 shadow-xs" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              YouTube
            </button>
            <button
              onClick={() => setSelectedPlatform("tiktok")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedPlatform === "tiktok" ? "bg-white font-bold text-stone-900 shadow-xs" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              TikTok
            </button>
            <button
              onClick={() => setSelectedPlatform("instagram")}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                selectedPlatform === "instagram" ? "bg-white font-bold text-fuchsia-600 shadow-xs" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Instagram
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[700px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-stone-50/70 text-stone-600">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Episode</th>
                <th className="py-2.5 px-3 font-semibold">Judul & Hook</th>
                <th className="py-2.5 px-3 font-semibold text-center">Total Views</th>
                <th className="py-2.5 px-3 font-semibold">YouTube Shorts</th>
                <th className="py-2.5 px-3 font-semibold">TikTok</th>
                <th className="py-2.5 px-3 font-semibold">IG Reels</th>
                <th className="py-2.5 px-3 font-semibold">Hook Level</th>
                <th className="py-2.5 px-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {enrichedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-500">
                    Belum ada data analitik untuk filter platform ini.
                  </td>
                </tr>
              ) : (
                enrichedRows.map((row) => {
                  const isViral = row.aiHookEvaluation?.hookStrength === "viral" || row.totalViews >= 1000;
                  const isStrong = row.aiHookEvaluation?.hookStrength === "strong" || (row.totalViews >= 400 && row.totalViews < 1000);

                  return (
                    <tr key={row.id} className="hover:bg-stone-50/80 transition-colors">
                      {/* Code */}
                      <td className="py-3 px-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          {isViral && <Flame className="h-3.5 w-3.5 text-amber-500" />}
                          {row.contentCode}
                        </span>
                      </td>

                      {/* Title & Category */}
                      <td className="py-3 px-3 max-w-[240px]">
                        <p className="font-semibold text-stone-900 truncate" title={row.title}>
                          {row.title}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate" title={row.hook}>
                          {row.category}
                        </p>
                      </td>

                      {/* Total Views */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 font-bold text-[11px] ${
                            row.totalViews >= 1000
                              ? "bg-emerald-100 text-emerald-800"
                              : row.totalViews >= 300
                              ? "bg-sky-100 text-sky-800"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {row.totalViews.toLocaleString("id-ID")}
                        </span>
                      </td>

                      {/* YouTube Column */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-rose-700">
                          {row.youtube?.views ? `${row.youtube.views.toLocaleString("id-ID")} v` : "-"}
                        </div>
                        {row.youtube && (
                          <div className="text-[10px] text-stone-500">
                            {row.youtube.watchTimeHours ? `${row.youtube.watchTimeHours}j` : ""}{" "}
                            {row.youtube.subscribersGained ? `• +${row.youtube.subscribersGained} subs` : ""}
                          </div>
                        )}
                      </td>

                      {/* TikTok Column */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-stone-900">
                          {row.tiktok?.views ? `${row.tiktok.views.toLocaleString("id-ID")} v` : "-"}
                        </div>
                        {row.tiktok && (
                          <div className="text-[10px] text-stone-500">
                            {row.tiktok.likes ? `❤️ ${row.tiktok.likes}` : ""}
                          </div>
                        )}
                      </td>

                      {/* Instagram Column */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-fuchsia-700">
                          {row.instagram?.views ? `${row.instagram.views.toLocaleString("id-ID")} v` : "-"}
                        </div>
                        {row.instagram && (
                          <div className="text-[10px] text-stone-500">
                            {row.instagram.likes ? `❤️ ${row.instagram.likes}` : ""}
                          </div>
                        )}
                      </td>

                      {/* Hook Level Badge */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            isViral
                              ? "bg-amber-100 text-amber-800"
                              : isStrong
                              ? "bg-sky-100 text-sky-800"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {isViral ? "🔥 Viral / Winner" : isStrong ? "⚡ Kuat" : "⏳ Standar / Batch"}
                        </span>
                      </td>

                      {/* Action Edit */}
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 hover:text-stone-900 shadow-2xs"
                        >
                          <Edit3 className="h-3 w-3 text-stone-500" />
                          <span>Update</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 5. Quick Update Modal Dialog */}
      {editingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-600">
                  {editingContent.contentCode}
                </span>
                <h3 className="text-base font-bold text-stone-900">
                  Update Metrik Analitik
                </h3>
                <p className="text-xs text-stone-500 truncate max-w-md">
                  {editingContent.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContent(null)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {feedback && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-lg p-3 text-xs ${
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-rose-50 text-rose-800"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveMetrics} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* YouTube Inputs */}
                <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-rose-600" /> YouTube Shorts
                  </h4>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Views</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.youtube.views}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          youtube: { ...editForm.youtube, views: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Watch Time (Jam)</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={editForm.youtube.watchTimeHours}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          youtube: { ...editForm.youtube, watchTimeHours: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">New Subs</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.youtube.subscribersGained}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          youtube: { ...editForm.youtube, subscribersGained: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* TikTok Inputs */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-stone-900" /> TikTok
                  </h4>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Views</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.tiktok.views}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          tiktok: { ...editForm.tiktok, views: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Likes</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.tiktok.likes}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          tiktok: { ...editForm.tiktok, likes: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Shares / Saves</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.tiktok.shares}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          tiktok: { ...editForm.tiktok, shares: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>

                {/* Instagram Inputs */}
                <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/30 p-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-fuchsia-900 flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-fuchsia-600" /> IG Reels
                  </h4>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Views / Tayangan</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.instagram.views}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          instagram: { ...editForm.instagram, views: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">Interaksi (Likes/Saves)</label>
                    <input
                      type="number"
                      min={0}
                      value={editForm.instagram.likes}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          instagram: { ...editForm.instagram, likes: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-stone-700">% Bukan Pengikut</label>
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={100}
                      value={editForm.instagram.nonFollowerPercentage}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          instagram: { ...editForm.instagram, nonFollowerPercentage: Number(e.target.value) || 0 },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingContent(null)}
                  className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
