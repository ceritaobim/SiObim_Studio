"use client";

import { useState } from "react";
import {
  Copy,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  CalendarClock,
  CheckSquare,
  FileJson,
  Info,
} from "lucide-react";
import type {
  AssetRecord,
  ContentItemRecord,
  PlatformName,
  PlatformPublicationRecord,
  PublishStatus,
} from "@/types/domain";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface PublishingCenterManagerProps {
  initialItems: ContentItemRecord[];
  initialSelectedContent: ContentItemRecord | null;
  initialPublications: PlatformPublicationRecord[];
  initialFinalVideoAsset: AssetRecord | null;
  timezone: string;
}

const PLATFORM_LABELS: Record<PlatformName, string> = {
  tiktok: "TikTok (9:16 • Durasi 65–80s)",
  youtube: "YouTube Shorts (9:16 • #Shorts)",
  instagram: "Instagram Reels (9:16 • Share to Feed)",
};

const CHECKLIST_LABELS: Record<string, string> = {
  videoMaster9x16Uploaded: "File MP4 Master 9:16 sudah diunggah ke aplikasi/studio",
  captionAndHashtagsCopied: "Caption, CTA & Hashtag sudah ditempel",
  coverFrameSelected: "Cover thumbnail origami sudah dipilih",
  soundCopyrightChecked: "Audio bebas klaim hak cipta",
  titleAndDescriptionCopied: "Judul #Shorts & Deskripsi sudah ditempel",
  notMadeForKidsSelected: "Opsi 'Tidak dibuat khusus untuk anak-anak' dipilih",
  visibilityScheduledOrPublic: "Visibilitas diatur ke Terjadwal / Publik",
  captionCopied: "Caption & Hashtag Reels sudah ditempel",
  shareToFeedEnabled: "Opsi 'Bagikan juga ke Feed' diaktifkan",
  coverFrameAdjusted: "Frame cover profil sudah disesuaikan",
};

export function PublishingCenterManager({
  initialItems,
  initialSelectedContent,
  initialPublications,
  initialFinalVideoAsset,
  timezone,
}: PublishingCenterManagerProps) {
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [selectedContentId, setSelectedContentId] = useState<string>(
    initialSelectedContent?.id ?? initialItems[0]?.id ?? ""
  );
  const [selectedContent, setSelectedContent] =
    useState<ContentItemRecord | null>(initialSelectedContent);
  const [publications, setPublications] =
    useState<PlatformPublicationRecord[]>(initialPublications);
  const [finalVideoAsset, setFinalVideoAsset] = useState<AssetRecord | null>(
    initialFinalVideoAsset
  );

  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSelectContent = async (contentId: string) => {
    setSelectedContentId(contentId);
    setFeedback(null);

    try {
      const res = await fetch(
        `/api/publishing?contentId=${encodeURIComponent(contentId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setSelectedContent(data.selectedContent);
        setPublications(data.publications ?? []);
        setFinalVideoAsset(data.finalVideoAsset ?? null);
      }
    } catch {
      // ignore error
    }
  };

  const handleUpdatePublication = async (
    pub: PlatformPublicationRecord,
    patch: Partial<{
      titleOrHook: string;
      captionText: string;
      hashtags: string;
      ctaText: string;
      checklist: Record<string, boolean>;
      scheduledAt: string | null;
      publishStatus: PublishStatus;
      externalPostUrl: string;
      notes: string;
    }>
  ) => {
    setSavingId(pub.id);
    setFeedback(null);

    try {
      const res = await fetch("/api/publishing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicationId: pub.id,
          ...patch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan publikasi.");
      }

      setPublications((prev) =>
        prev.map((p) => (p.id === data.publication.id ? data.publication : p))
      );
      setFeedback({
        type: "success",
        text: `Paket publikasi ${PLATFORM_LABELS[pub.platform]} berhasil diperbarui.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan perubahan publikasi.",
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Content Selector & Full Project JSON Export */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div className="space-y-1">
          <label
            htmlFor="pubContentSelect"
            className="block text-xs font-semibold uppercase tracking-wider text-stone-500"
          >
            Pilih Konten untuk Paket Publikasi Multi-Platform ({timezone})
          </label>
          <select
            id="pubContentSelect"
            value={selectedContentId}
            onChange={(e) => handleSelectContent(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-900 sm:w-96 sm:text-sm"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.contentCode} — {item.title} [{item.contentStatus}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {finalVideoAsset ? (
            <a
              href={`/api/assembly?contentId=${encodeURIComponent(
                selectedContentId
              )}&download=1`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              <span>Unduh Master MP4 ({finalVideoAsset.originalFilename})</span>
            </a>
          ) : (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
              Video Master 9:16 belum dirakit di menu Assets
            </span>
          )}

          <a
            href="/api/export-project"
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 font-semibold text-stone-800 hover:bg-stone-100"
          >
            <FileJson className="h-4 w-4 text-amber-600" />
            <span>Backup Proyek (JSON)</span>
          </a>
        </div>
      </div>

      {/* Monetization & Manual Publishing Honesty Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
        <div className="space-y-1">
          <p className="font-semibold">
            Catatan Kejujuran Publikasi & Monetisasi (Sesuai PRD)
          </p>
          <p>
            Publikasi MVP dilakukan secara <strong>manual</strong> untuk menjaga keamanan akun kreator Anda. Status <code>published</code> hanya berubah setelah Anda mengonfirmasi unggahan manual di bawah. Durasi target{" "}
            <strong>{selectedContent?.targetDurationSeconds ?? 70} detik</strong> mendukung retensi konten panjang, namun kelayakan monetisasi tetap bergantung pada syarat pengikut, jam tayang, dan orisinalitas di masing-masing platform.
          </p>
        </div>
      </div>

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

      {/* Platform Package Cards (TikTok, YouTube Shorts, Instagram Reels) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {publications.map((pub) => {
          const isPublished = pub.publishStatus === "published";
          const fullCopyBlock = `${pub.titleOrHook}\n\n${pub.captionText}\n\n${pub.ctaText}\n\n${pub.hashtags}`;

          return (
            <SectionCard
              key={pub.id}
              title={PLATFORM_LABELS[pub.platform]}
              description={`Kode: ${selectedContent?.contentCode ?? "-"} • Zona Waktu: ${timezone}`}
              badge={
                <StatusBadge
                  label={pub.publishStatus.replace(/_/g, " ").toUpperCase()}
                  variant={
                    isPublished
                      ? "success"
                      : pub.publishStatus === "scheduled"
                      ? "info"
                      : "warning"
                  }
                />
              }
            >
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700">
                    Judul / Hook Pembuka
                  </label>
                  <input
                    type="text"
                    value={pub.titleOrHook}
                    onChange={(e) =>
                      setPublications((prev) =>
                        prev.map((p) =>
                          p.id === pub.id
                            ? { ...p, titleOrHook: e.target.value }
                            : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700">
                    Caption / Deskripsi Platform
                  </label>
                  <textarea
                    rows={3}
                    value={pub.captionText}
                    onChange={(e) =>
                      setPublications((prev) =>
                        prev.map((p) =>
                          p.id === pub.id
                            ? { ...p, captionText: e.target.value }
                            : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-stone-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700">
                    Hashtags & CTA
                  </label>
                  <input
                    type="text"
                    value={pub.hashtags}
                    onChange={(e) =>
                      setPublications((prev) =>
                        prev.map((p) =>
                          p.id === pub.id
                            ? { ...p, hashtags: e.target.value }
                            : p
                        )
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-mono text-[11px] text-stone-800"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(fullCopyBlock);
                      setFeedback({
                        type: "success",
                        text: `Paket teks ${PLATFORM_LABELS[pub.platform]} berhasil disalin ke clipboard!`,
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 font-semibold text-stone-800 hover:bg-stone-100"
                  >
                    <Copy className="h-3.5 w-3.5 text-amber-600" />
                    <span>Salin Semua Teks</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingId === pub.id}
                    onClick={() =>
                      handleUpdatePublication(pub, {
                        titleOrHook: pub.titleOrHook,
                        captionText: pub.captionText,
                        hashtags: pub.hashtags,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                  >
                    <span>Simpan Teks</span>
                  </button>
                </div>

                {/* Checklist */}
                <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-2.5 space-y-1.5">
                  <p className="flex items-center gap-1 font-semibold text-stone-800">
                    <CheckSquare className="h-3.5 w-3.5 text-amber-600" />
                    <span>Checklist Unggah Manual</span>
                  </p>
                  {Object.entries(pub.checklist).map(([key, checked]) => (
                    <label
                      key={key}
                      className="flex items-start gap-2 text-[11px] text-stone-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checked)}
                        onChange={(e) => {
                          const nextChecklist = {
                            ...pub.checklist,
                            [key]: e.target.checked,
                          };
                          handleUpdatePublication(pub, {
                            checklist: nextChecklist,
                          });
                        }}
                        className="mt-0.5 rounded border-stone-300"
                      />
                      <span>{CHECKLIST_LABELS[key] || key}</span>
                    </label>
                  ))}
                </div>

                {/* Schedule & Published URL */}
                <div className="space-y-2 pt-1 border-t border-stone-200">
                  <div>
                    <label className="flex items-center gap-1 font-semibold text-stone-700">
                      <CalendarClock className="h-3.5 w-3.5 text-stone-500" />
                      <span>Jadwal Rilis Rencana ({timezone})</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={pub.scheduledAt ? pub.scheduledAt.slice(0, 16) : ""}
                      onChange={(e) => {
                        const val = e.target.value
                          ? new Date(e.target.value).toISOString()
                          : null;
                        handleUpdatePublication(pub, {
                          scheduledAt: val,
                          publishStatus: val ? "scheduled" : pub.publishStatus,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1 font-semibold text-stone-700">
                      <ExternalLink className="h-3.5 w-3.5 text-stone-500" />
                      <span>URL Postingan Setelah Terbit (Opsional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.tiktok.com/@ceritaobim/video/..."
                      value={pub.externalPostUrl}
                      onChange={(e) =>
                        setPublications((prev) =>
                          prev.map((p) =>
                            p.id === pub.id
                              ? { ...p, externalPostUrl: e.target.value }
                              : p
                          )
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-stone-900"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <select
                      value={pub.publishStatus}
                      onChange={(e) =>
                        handleUpdatePublication(pub, {
                          publishStatus: e.target.value as PublishStatus,
                          externalPostUrl: pub.externalPostUrl,
                        })
                      }
                      className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-800"
                    >
                      <option value="draft">Draft</option>
                      <option value="ready_for_manual_upload">
                        Siap Unggah Manual
                      </option>
                      <option value="scheduled">Terjadwal (Scheduled)</option>
                      <option value="published">
                        Sudah Terbit (Published)
                      </option>
                    </select>

                    <button
                      type="button"
                      disabled={savingId === pub.id}
                      onClick={() =>
                        handleUpdatePublication(pub, {
                          publishStatus: isPublished
                            ? "ready_for_manual_upload"
                            : "published",
                          externalPostUrl: pub.externalPostUrl,
                        })
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-white ${
                        isPublished
                          ? "bg-stone-600 hover:bg-stone-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {isPublished
                          ? "Batalkan Status Terbit"
                          : "Konfirmasi Sudah Terbit"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
