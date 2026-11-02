import Link from "next/link";
import {
  CalendarRange,
  Mic,
  Film,
  Send,
  ArrowRight,
  Zap,
  CheckCircle2,
  Sparkles,
  Play,
  Layers,
  Wrench,
  Bot,
  FolderOpen,
} from "lucide-react";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  getProjectSettings,
  listAllScenesGroupedByContent,
  listAssetsForContent,
  listContentItems,
  listOrInitializePublications,
} from "@/lib/db/repository";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProductionPriorityCard } from "@/components/dashboard/production-priority-card";

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const owner = await getAuthorizedOwner();
  const [settings, items, allAssets, allPubs, scenesByContent] =
    await Promise.all([
      getProjectSettings(owner.ownerId),
      listContentItems(owner.ownerId),
      listAssetsForContent(owner.ownerId),
      listOrInitializePublications(owner.ownerId),
      listAllScenesGroupedByContent(owner.ownerId),
    ]);

  const totalPlanned = items.length;
  const itemsWithAudio = items.filter((item) =>
    allAssets.some(
      (a) => a.contentId === item.id && a.assetType === "voice_audio"
    )
  );
  const itemsWithFinalVideo = items.filter((item) =>
    allAssets.some(
      (a) => a.contentId === item.id && a.assetType === "final_video"
    )
  );

  let totalSceneCount = 0;
  let completedSceneClipCount = 0;
  for (const item of items) {
    const scList = scenesByContent[item.id] ?? [];
    totalSceneCount += scList.length;
    const itemAssets = allAssets.filter((a) => a.contentId === item.id);
    for (const sc of scList) {
      const hasClip = itemAssets.some(
        (a) =>
          a.assetType === "scene_video" &&
          (a.sceneId === sc.id || a.id === sc.uploadedClipAssetId)
      );
      if (hasClip) completedSceneClipCount++;
    }
  }

  const currentDateFormatted = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* 1. HERO GREETING CARD (Inspired by Reference UI) */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/40 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              {currentDateFormatted}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Hello, Creator Obim 👋
            </h2>
            <p className="text-base sm:text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              How can I help you today?
            </p>
            <p className="text-xs text-slate-500 max-w-xl pt-1">
              Seluruh alur produksi riset sains, voice over origami, perakitan video vertikal 9:16, dan auto-publish ke Buffer siap dijalankan.
            </p>
          </div>

          {/* Glowing AI Orb (Matching Reference UI) */}
          <div className="flex shrink-0 items-center justify-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white">
                <Sparkles className="h-8 w-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Ambient background blur */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-purple-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-48 h-48 w-48 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      {/* 2. PRODUCTION PRIORITY & COUNTDOWN WIDGET */}
      <ProductionPriorityCard
        items={items}
        allAssets={allAssets}
        scenesByContent={scenesByContent}
      />

      {/* 3. FOUR CORE METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Planning */}
        <Link
          href="/content"
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Content Plan
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CalendarRange className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">{totalPlanned}</p>
            <p className="text-xs font-semibold text-slate-500">
              Topik Sains Unik Siap
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
            <span>Buka Jadwal</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Voice Over */}
        <Link
          href="/production"
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              2. Voice Over
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Mic className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">
              {itemsWithAudio.length}/{totalPlanned}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Audio Narasi Selesai
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-sky-600 group-hover:translate-x-0.5 transition-transform">
            <span>Buka Audio Studio</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Video Klip & 00Final */}
        <Link
          href="/assets"
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              3. Video Studio
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Film className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">
              {itemsWithFinalVideo.length}/{totalPlanned}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Video Final 00Final.mp4
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
            <span>Buka Video Studio</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>

        {/* Publishing (Buffer) */}
        <Link
          href="/publishing"
          className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              4. Buffer Auto-Publish
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">3 Medsos</p>
            <p className="text-xs font-semibold text-slate-500">
              YouTube • TikTok • IG
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
            <span>Publish Sekarang</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </Link>
      </div>

      {/* 3. PIPELINE OVERVIEW (Inspired by "My Tasks" in Reference UI) */}
      <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-indigo-50 pb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900">
              Antrean Video Siap Tayang (00Final.mp4)
            </h3>
          </div>
          <Link
            href="/publishing"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            Lihat Semua Antrean &rarr;
          </Link>
        </div>

        <div className="space-y-3">
          {itemsWithFinalVideo.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/40 p-4 hover:bg-white hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs">
                  ✓
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {item.contentCode}
                    </span>
                    <span className="truncate text-xs font-bold text-slate-900">
                      {item.title}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500 mt-0.5">
                    {item.programName || "Sains Unik"} • Format: Vertical 9:16 Stop-Motion Origami
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/assembly?contentId=${encodeURIComponent(
                    item.id
                  )}&download=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Play className="h-3 w-3 text-slate-500" />
                  <span>Preview</span>
                </a>

                <Link
                  href="/publishing"
                  className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  <span>Publish</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
