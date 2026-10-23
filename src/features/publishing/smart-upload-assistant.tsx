"use client";

import { useState } from "react";
import {
  UploadCloud,
  Clock,
  Copy,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type {
  ContentItemRecord,
  PlatformName,
  PlatformPublicationRecord,
} from "@/types/domain";
import { StatusBadge } from "@/components/ui/status-badge";

interface SmartUploadAssistantProps {
  initialItems: ContentItemRecord[];
  initialAllPublications: PlatformPublicationRecord[];
}

const PLATFORM_ALGO_CONFIG: Record<
  PlatformName,
  {
    name: string;
    bestTimeWib: string;
    algoReason: string;
    badgeColor: string;
    buttonBg: string;
  }
> = {
  youtube: {
    name: "YouTube Shorts",
    bestTimeWib: "17:00 – 18:00 WIB",
    algoReason:
      "Algoritma YouTube Shorts butuh waktu indeks 1–2 jam sebelum didorong ke penonton prime-time malam.",
    badgeColor: "bg-rose-50 text-rose-900 border-rose-200",
    buttonBg: "bg-rose-600 hover:bg-rose-700",
  },
  tiktok: {
    name: "TikTok",
    bestTimeWib: "18:30 – 19:30 WIB",
    algoReason:
      "Jam pulang kerja & istirahat malam. Algoritma FYP menilai rasio tonton ulang & komentar di 30 menit pertama.",
    badgeColor: "bg-stone-100 text-stone-900 border-stone-300",
    buttonBg: "bg-stone-900 hover:bg-stone-800",
  },
  instagram: {
    name: "Instagram Reels",
    bestTimeWib: "19:30 – 20:45 WIB",
    algoReason:
      "Jam santai scroll Reels & kirim DM (Share) ke teman, sinyal utama algoritma Instagram.",
    badgeColor: "bg-amber-50 text-amber-900 border-amber-200",
    buttonBg: "bg-amber-600 hover:bg-amber-700",
  },
};

export function SmartUploadAssistant({
  initialItems,
  initialAllPublications,
}: SmartUploadAssistantProps) {
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [publications, setPublications] = useState<
    PlatformPublicationRecord[]
  >(initialAllPublications);

  // Automatically pick the first content item that hasn't finished uploading to all 3 platforms
  const firstUnfinishedContent =
    items.find((item) => {
      const pubs = publications.filter((p) => p.contentId === item.id);
      return pubs.filter((p) => p.publishStatus === "published").length < 3;
    }) ??
    items[0] ??
    null;

  const [selectedContentId, setSelectedContentId] = useState<string>(
    firstUnfinishedContent?.id ?? ""
  );

  // Step-by-Step Popup Wizard State
  const [activeModalPub, setActiveModalPub] =
    useState<PlatformPublicationRecord | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [postUrlInput, setPostUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const selectedContent =
    items.find((i) => i.id === selectedContentId) ?? items[0] ?? null;

  const pubsForSelected = publications.filter(
    (p) => p.contentId === selectedContent?.id
  );

  const openWizard = (pub: PlatformPublicationRecord) => {
    setActiveModalPub(pub);
    setWizardStep(1);
    setPostUrlInput(pub.externalPostUrl || "");
    setCopiedToast(null);
  };

  const closeWizard = () => {
    setActiveModalPub(null);
    setCopiedToast(null);
  };

  const getAlgorithmicTitle = (
    content: ContentItemRecord,
    platform: PlatformName
  ) => {
    if (platform === "youtube") {
      return `${content.title} #Shorts`;
    }
    return content.title;
  };

  const getAlgorithmicDescriptionAndHashtags = (
    content: ContentItemRecord,
    pub: PlatformPublicationRecord
  ) => {
    const baseDesc =
      pub.captionText || content.tiktokCaption || content.youtubeDescription;
    const defaultHashtags =
      "#ceritaobim #psikologi #faktaunik #selfimprovement #edukasi";
    const hasHashtag = baseDesc.includes("#");
    return {
      descriptionOnly: baseDesc,
      hashtagsOnly: pub.hashtags || defaultHashtags,
      combined: hasHashtag ? baseDesc : `${baseDesc}\n\n${defaultHashtags}`,
    };
  };

  const handleCopyAndNext = async (
    text: string,
    label: string,
    nextStep: 2 | 3 | 4
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToast(`${label} berhasil di-copy ke clipboard!`);
    } catch {
      // ignore clipboard error
    }
    setWizardStep(nextStep);
  };

  const handleFinishUpload = async () => {
    if (!activeModalPub) return;
    setSaving(true);

    try {
      const res = await fetch("/api/publishing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId: activeModalPub.id,
          publishStatus: "published",
          externalPostUrl: postUrlInput.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.publication) {
        const updatedList = publications.map((p) =>
          p.id === data.publication.id ? data.publication : p
        );
        setPublications(updatedList);

        // Check if all 3 platforms for this content are now published -> auto-advance to next day's content!
        const currentContentPubs = updatedList.filter(
          (p) => p.contentId === activeModalPub.contentId
        );
        if (
          currentContentPubs.filter((p) => p.publishStatus === "published")
            .length >= 3
        ) {
          const nextContent = items.find((item) => {
            if (item.id === activeModalPub.contentId) return false;
            const pList = updatedList.filter((p) => p.contentId === item.id);
            return (
              pList.filter((p) => p.publishStatus === "published").length < 3
            );
          });
          if (nextContent) {
            setSelectedContentId(nextContent.id);
          }
        }
      }
      closeWizard();
    } finally {
      setSaving(false);
    }
  };

  if (!selectedContent) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Top Smart Queue Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Antrean Upload Otomatis Hari Ini
            </span>
          </div>
          <h1 className="mt-1 text-base font-bold text-stone-900 sm:text-lg">
            {selectedContent.publishedAt || selectedContent.contentCode} —{" "}
            {selectedContent.title}
          </h1>
          <p className="text-xs text-stone-500">
            Begitu 3 sosmed pada konten ini selesai diupload, tampilan otomatis berpindah ke konten hari berikutnya.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="uploadSelect" className="font-semibold text-stone-600">
            Ganti Hari:
          </label>
          <select
            id="uploadSelect"
            value={selectedContent.id}
            onChange={(e) => setSelectedContentId(e.target.value)}
            className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 font-semibold text-stone-900"
          >
            {items.map((item) => {
              const pList = publications.filter((p) => p.contentId === item.id);
              const done = pList.filter(
                (p) => p.publishStatus === "published"
              ).length;
              return (
                <option key={item.id} value={item.id}>
                  {item.contentCode} ({done}/3 Upload) — {item.title.slice(0, 32)}...
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* 3 Platform Cards with Algorithmic Best Upload Hours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(["youtube", "tiktok", "instagram"] as PlatformName[]).map(
          (platform) => {
            const pub = pubsForSelected.find((p) => p.platform === platform);
            if (!pub) return null;
            const cfg = PLATFORM_ALGO_CONFIG[platform];
            const isPublished = pub.publishStatus === "published";

            return (
              <div
                key={pub.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs ${
                  isPublished
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${cfg.badgeColor}`}
                    >
                      {cfg.name}
                    </span>
                    <StatusBadge
                      label={isPublished ? "✅ Terupload" : "Belum Upload"}
                      variant={isPublished ? "success" : "warning"}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Jam Algoritma: {cfg.bestTimeWib}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-stone-600 leading-relaxed">
                      {cfg.algoReason}
                    </p>
                  </div>

                  <div className="mt-3 text-xs space-y-1">
                    <p className="font-semibold text-stone-800 line-clamp-1">
                      Judul: {getAlgorithmicTitle(selectedContent, platform)}
                    </p>
                    {pub.externalPostUrl ? (
                      <a
                        href={pub.externalPostUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                      >
                        <span>Lihat Video Terupload</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => openWizard(pub)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs ${
                      isPublished
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : cfg.buttonBg
                    }`}
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>
                      {isPublished
                        ? `Lihat / Edit Upload ${cfg.name}`
                        : `Mulai Upload ${cfg.name}`}
                    </span>
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Summary Table of All Contents Upload Status */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-stone-200 px-5 py-3.5">
          <h2 className="text-sm font-bold text-stone-900">
            Tabel Riwayat & Antrean Upload Semua Konten
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase text-stone-500">
                <th className="py-3 px-4">Jadwal / Kode</th>
                <th className="py-3 px-4">Judul Konten</th>
                <th className="py-3 px-4">YT Shorts (17:00)</th>
                <th className="py-3 px-4">TikTok (18:30)</th>
                <th className="py-3 px-4">IG Reels (19:30)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map((item) => {
                const pList = publications.filter(
                  (p) => p.contentId === item.id
                );
                const yt = pList.find((p) => p.platform === "youtube");
                const tt = pList.find((p) => p.platform === "tiktok");
                const ig = pList.find((p) => p.platform === "instagram");

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedContentId(item.id)}
                    className={`cursor-pointer hover:bg-stone-50 ${
                      item.id === selectedContent.id ? "bg-amber-50/40" : ""
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-stone-900">
                      {item.contentCode}
                      <span className="block font-sans font-normal text-[11px] text-stone-500">
                        {item.publishedAt}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900 max-w-xs">
                      {item.title}
                    </td>
                    <td className="py-3 px-4">
                      {yt?.publishStatus === "published" ? (
                        <StatusBadge label="✅ Sudah" variant="success" />
                      ) : (
                        <StatusBadge label="Belum" variant="neutral" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {tt?.publishStatus === "published" ? (
                        <StatusBadge label="✅ Sudah" variant="success" />
                      ) : (
                        <StatusBadge label="Belum" variant="neutral" />
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {ig?.publishStatus === "published" ? (
                        <StatusBadge label="✅ Sudah" variant="success" />
                      ) : (
                        <StatusBadge label="Belum" variant="neutral" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* STEP-BY-STEP POPUP MODAL FOR MOBILE / DESKTOP UPLOAD */}
      {activeModalPub ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Langkah {wizardStep} dari 4 •{" "}
                  {PLATFORM_ALGO_CONFIG[activeModalPub.platform].name}
                </span>
                <h3 className="text-sm font-bold text-stone-900 sm:text-base">
                  {selectedContent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeWizard}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {copiedToast ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{copiedToast}</span>
              </div>
            ) : null}

            {/* STEP 1: Sudah Upload Video Hasil CapCut? */}
            {wizardStep === 1 ? (
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2">
                  <p className="font-bold text-amber-950">
                    1. Sudah masukkan video hasil CapCut ke aplikasi{" "}
                    {PLATFORM_ALGO_CONFIG[activeModalPub.platform].name}?
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Pastikan video berformat vertikal 9:16 tanpa watermark dan pilih frame sampul (cover) yang paling jelas. Jam upload terbaik:{" "}
                    <strong>
                      {PLATFORM_ALGO_CONFIG[activeModalPub.platform].bestTimeWib}
                    </strong>
                    .
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 sm:text-sm"
                  >
                    <span>Sudah Pilih Video, Lanjut ke Judul</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* STEP 2: Copy Judul */}
            {wizardStep === 2 ? (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-stone-800">
                    2. Judul Video (Dioptimalkan Algoritma{" "}
                    {PLATFORM_ALGO_CONFIG[activeModalPub.platform].name}):
                  </label>
                  <div className="mt-2 rounded-xl border border-stone-300 bg-stone-50 p-3.5 font-semibold text-stone-900 select-all">
                    {getAlgorithmicTitle(
                      selectedContent,
                      activeModalPub.platform
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyAndNext(
                        getAlgorithmicTitle(
                          selectedContent,
                          activeModalPub.platform
                        ),
                        "Judul",
                        3
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 sm:text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copy Judul & Lanjut ke Deskripsi</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* STEP 3: Copy Deskripsi & Hashtag */}
            {wizardStep === 3 ? (
              <div className="space-y-4 text-xs sm:text-sm">
                {(() => {
                  const descPack = getAlgorithmicDescriptionAndHashtags(
                    selectedContent,
                    activeModalPub
                  );
                  return (
                    <>
                      <div>
                        <label className="block font-bold text-stone-800">
                          3. Deskripsi, Pertanyaan Pancingan Komen (CTA) & Hashtag:
                        </label>
                        <div className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-300 bg-stone-50 p-3.5 text-xs text-stone-900 select-all">
                          {descPack.combined}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardStep(2)}
                          className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          <span>Kembali</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleCopyAndNext(
                              descPack.combined,
                              "Deskripsi + Hashtag",
                              4
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 sm:text-sm"
                        >
                          <Copy className="h-4 w-4" />
                          <span>Copy Deskripsi & Lanjut Terakhir</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}

            {/* STEP 4: Masukkan Link Video & Tandai Sudah Terupload */}
            {wizardStep === 4 ? (
              <div className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block font-bold text-stone-800">
                    4. Tempel Link Video yang Sudah Terupload (Opsional):
                  </label>
                  <p className="mt-0.5 text-xs text-stone-500">
                    Setelah Anda klik Publish/Jadwalkan di aplikasi{" "}
                    {PLATFORM_ALGO_CONFIG[activeModalPub.platform].name}, tempel link videonya di bawah lalu klik Selesai.
                  </p>
                  <input
                    type="url"
                    value={postUrlInput}
                    onChange={(e) => setPostUrlInput(e.target.value)}
                    placeholder={`https://www.${activeModalPub.platform}.com/... (boleh dikosongkan jika dijadwalkan)`}
                    className="mt-2 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-stone-900 focus:border-emerald-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Kembali</span>
                  </button>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleFinishUpload}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 sm:text-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {saving
                        ? "Menyimpan..."
                        : "✅ Selesai! Tandai Sudah Terupload"}
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
