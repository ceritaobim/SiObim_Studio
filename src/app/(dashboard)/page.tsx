import Link from "next/link";
import {
  CalendarRange,
  Mic,
  Film,
  UploadCloud,
  ArrowRight,
  Zap,
  CheckCircle2,
  FolderOpen,
  Sparkles,
  LayoutDashboard,
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

  // 1. Content Planning Progress
  const totalPlanned = items.length;
  const currentWeekNumber = Math.max(1, Math.ceil(totalPlanned / 7));
  const lastPlannedItem = items[items.length - 1] ?? null;

  // 2. Audio (ElevenLabs) Progress
  const itemsWithAudio = items.filter((item) =>
    allAssets.some(
      (a) => a.contentId === item.id && a.assetType === "voice_audio"
    )
  );
  const nextAudioTarget =
    items.find(
      (item) =>
        !allAssets.some(
          (a) => a.contentId === item.id && a.assetType === "voice_audio"
        )
    ) ?? null;

  // 3. Video (GFlow 10-second clips) Progress
  let totalSceneCount = 0;
  let completedSceneClipCount = 0;
  let activeVideoItem: (typeof items)[number] | null = null;
  let activeVideoItemDoneClips = 0;
  let activeVideoItemTotalScenes = 0;

  for (const item of items) {
    const itemScenes = scenesByContent[item.id] ?? [];
    const itemClips = allAssets.filter(
      (a) => a.contentId === item.id && a.assetType === "scene_video"
    );
    const doneForThisItem = itemScenes.filter(
      (sc) =>
        Boolean(sc.uploadedClipAssetId) ||
        itemClips.some((c) => c.sceneId === sc.id)
    ).length;

    totalSceneCount += itemScenes.length;
    completedSceneClipCount += doneForThisItem;

    if (!activeVideoItem && doneForThisItem < itemScenes.length) {
      activeVideoItem = item;
      activeVideoItemDoneClips = doneForThisItem;
      activeVideoItemTotalScenes = itemScenes.length;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Monitor Produksi & Alokasi Kredit AI
            </span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-stone-900 sm:text-xl">
            Status Pengerjaan Konten @{settings.channelName}
          </h1>
          <p className="text-xs text-stone-500">
            Pantau sudah sampai tanggal/hari mana Content Plan, Audio ElevenLabs, dan Video 10 Detik GFlow berjalan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/publishing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Buka Menu Upload Hari Ini</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard & GDrive</span>
          </Link>
        </div>
      </div>

      {/* 3 Main Jobdesc Monitor Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Content Planning */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                <CalendarRange className="h-4 w-4 text-amber-600" />
                1. Content Planning
              </span>
              <StatusBadge
                label={`Week ${currentWeekNumber} (${totalPlanned} Konten)`}
                variant="success"
              />
            </div>

            <p className="mt-3 text-2xl font-extrabold text-stone-900">
              {totalPlanned} / {currentWeekNumber * 7} Hari Terjadwal
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Siap sampai:{" "}
              <strong className="text-stone-900">
                {lastPlannedItem
                  ? `${lastPlannedItem.publishedAt || lastPlannedItem.contentCode} (${lastPlannedItem.title.slice(0, 36)}...)`
                  : "Belum ada"}
              </strong>
            </p>

            <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-950">
              <p className="font-semibold">Status Kredit AI (Gemini/LLM):</p>
              <p className="mt-0.5 text-[11px] text-amber-900">
                Week {currentWeekNumber + 1} belum di-generate. Klik trigger di menu Content Planning saat siap membuat 7 konten minggu depan + folder GDrive otomatis.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500">
              Target: 7 konten / minggu
            </span>
            <Link
              href="/content"
              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-800"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Buka & Trigger Plan</span>
            </Link>
          </div>
        </div>

        {/* 2. Audio (ElevenLabs) */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Mic className="h-4 w-4 text-sky-600" />
                2. Audio (ElevenLabs)
              </span>
              <StatusBadge
                label={`${itemsWithAudio.length}/${totalPlanned} Selesai`}
                variant={
                  itemsWithAudio.length === totalPlanned ? "success" : "info"
                }
              />
            </div>

            <p className="mt-3 text-2xl font-extrabold text-stone-900">
              {itemsWithAudio.length} / {totalPlanned} Konten Audio
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Target Kredit Berikutnya:{" "}
              <strong className="text-stone-900">
                {nextAudioTarget
                  ? `${nextAudioTarget.publishedAt || nextAudioTarget.contentCode} — ${nextAudioTarget.title.slice(0, 32)}...`
                  : "Semua konten sudah punya Audio!"}
              </strong>
            </p>

            <div className="mt-3 rounded-xl border border-sky-200/80 bg-sky-50/60 p-3 text-xs text-sky-950">
              <p className="font-semibold">Alokasi Kredit ElevenLabs:</p>
              <p className="mt-0.5 text-[11px] text-sky-900">
                {nextAudioTarget
                  ? `Konten berikutnya membutuhkan ~${nextAudioTarget.narration.length} karakter kredit suara.`
                  : "Tidak ada antrean kredit suara yang tertunda."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500">
              1 file MP3 full per konten
            </span>
            <Link
              href="/production"
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Buka & Trigger Audio</span>
            </Link>
          </div>
        </div>

        {/* 3. Video (GFlow 10-second clips) */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
                <Film className="h-4 w-4 text-emerald-600" />
                3. Video (GFlow 10 Detik)
              </span>
              <StatusBadge
                label={
                  activeVideoItem
                    ? `${activeVideoItemDoneClips}/${activeVideoItemTotalScenes} Scene`
                    : "Lengkap"
                }
                variant={activeVideoItem ? "warning" : "success"}
              />
            </div>

            <p className="mt-3 text-2xl font-extrabold text-stone-900">
              { activeVideoItem
                ? `${activeVideoItem.publishedAt?.split("-")[0]?.trim() || activeVideoItem.contentCode} (${activeVideoItemDoneClips}/${activeVideoItemTotalScenes})`
                : `${completedSceneClipCount}/${totalSceneCount} Klip Selesai` }
            </p>
            <p className="mt-1 text-xs text-stone-600">
              Sedang Dikerjakan:{" "}
              <strong className="text-stone-900">
                {activeVideoItem
                  ? `${activeVideoItem.title.slice(0, 38)}...`
                  : "Semua klip scene sudah lengkap!"}
              </strong>
            </p>

            <div className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs text-emerald-950">
              <p className="font-semibold">Alokasi Kredit Video (Per 10 Detik):</p>
              <p className="mt-0.5 text-[11px] text-emerald-900">
                Total semua konten: <strong>{completedSceneClipCount} dari {totalSceneCount} klip</strong> selesai. Kredit video berikutnya dialokasikan ke{" "}
                <strong>
                  {activeVideoItem
                    ? `${activeVideoItem.contentCode} Scene #${activeVideoItemDoneClips + 1}`
                    : "-"}
                </strong>
                .
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-[11px] text-stone-500">
              ~8 klip (10 dtk) per konten
            </span>
            <Link
              href="/assets"
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Buka & Trigger Video</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Pipeline Table: All Planned Contents & Exact Progress (Audio 0/1, Video X/8, Upload X/3) */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col justify-between gap-2 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-stone-900 sm:text-base">
              Tabel Monitor Pengerjaan Harian (Siap CapCut & Upload)
            </h2>
            <p className="text-xs text-stone-500">
              Lihat langsung progres Audio, jumlah klip Video 10 detik, dan status Upload per jadwal hari.
            </p>
          </div>
          {settings.googleSheetUrl ? (
            <a
              href={settings.googleSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100"
            >
              <FolderOpen className="h-3.5 w-3.5 text-amber-600" />
              <span>Buka Spreadsheet / GDrive</span>
            </a>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-3 px-4">Jadwal / Kode</th>
                <th className="py-3 px-4">Judul Konten</th>
                <th className="py-3 px-4">Audio (ElevenLabs)</th>
                <th className="py-3 px-4">Video (Klip 10s)</th>
                <th className="py-3 px-4">Status Upload</th>
                <th className="py-3 px-4 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => {
                const hasAudio = allAssets.some(
                  (a) =>
                    a.contentId === item.id && a.assetType === "voice_audio"
                );
                const itemScenes = scenesByContent[item.id] ?? [];
                const itemClips = allAssets.filter(
                  (a) =>
                    a.contentId === item.id && a.assetType === "scene_video"
                );
                const doneClips = itemScenes.filter(
                  (sc) =>
                    Boolean(sc.uploadedClipAssetId) ||
                    itemClips.some((c) => c.sceneId === sc.id)
                ).length;
                const pubsForItem = allPubs.filter(
                  (p) => p.contentId === item.id
                );
                const uploadedPlatforms = pubsForItem.filter(
                  (p) => p.publishStatus === "published"
                ).length;

                return (
                  <tr key={item.id} className="hover:bg-stone-50/80">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-amber-900">
                        {item.contentCode}
                      </span>
                      <span className="block text-[11px] text-stone-500">
                        {item.publishedAt || "Jadwal Mingguan"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900 max-w-xs">
                      <span className="line-clamp-2">{item.title}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {hasAudio ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          1 / 1 Siap
                        </span>
                      ) : (
                        <Link
                          href="/production"
                          className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 font-semibold text-stone-600 hover:bg-sky-50 hover:text-sky-800"
                        >
                          0 / 1 (Belum)
                        </Link>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Link
                        href="/assets"
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${
                          doneClips === itemScenes.length &&
                          itemScenes.length > 0
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : doneClips > 0
                            ? "bg-amber-50 border border-amber-200 text-amber-900"
                            : "bg-stone-100 text-stone-700"
                        }`}
                      >
                        {doneClips} / {itemScenes.length} Klip
                      </Link>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                          uploadedPlatforms === 3
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : uploadedPlatforms > 0
                            ? "bg-sky-50 border border-sky-200 text-sky-900"
                            : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {uploadedPlatforms} / 3 Sosmed
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href="/publishing"
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 font-semibold text-stone-800 hover:bg-stone-100"
                      >
                        <span>Siap Upload</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
