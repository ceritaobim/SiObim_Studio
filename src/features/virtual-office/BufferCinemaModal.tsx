"use client";

import React from "react";
import { X, Film, Send, CalendarClock, CheckCircle2, Layers } from "lucide-react";
import { BufferSchedulePosterItem } from "./types";

interface BufferCinemaModalProps {
  posters: BufferSchedulePosterItem[];
  selectedPoster: BufferSchedulePosterItem | null;
  onClose: () => void;
  onPublishCode: (code: string) => void;
  onTalkToBufferPublisher: () => void;
}

export function BufferCinemaModal({
  posters,
  selectedPoster,
  onClose,
  onPublishCode,
  onTalkToBufferPublisher,
}: BufferCinemaModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-[#f5f3ef] border-2 border-[#3f271d] shadow-2xl text-stone-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* REALISTIC ARCHITECTURAL GALLERY HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-[#2c1d16] text-stone-100 border-b border-[#b48a3e]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#b48a3e] flex items-center justify-center shadow">
              <Film className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-stone-100 uppercase">
                  Galeri Jadwal Tayang Buffer
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#b48a3e]/25 text-amber-200 border border-[#b48a3e]/50">
                  Publisher: Buffer
                </span>
              </div>
              <p className="text-xs text-stone-300">
                Daftar antrean rilis konten berurutan untuk TikTok, YouTube Shorts & Instagram Reels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTalkToBufferPublisher}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#b48a3e] hover:bg-amber-500 text-stone-950 text-xs font-extrabold shadow transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bicara dengan Buffer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
              title="Tutup Galeri Buffer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* REALISTIC GALLERY EXHIBITION GRID */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#f5f3ef]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {posters.map((poster) => {
              const isHighlighted = selectedPoster?.slotIndex === poster.slotIndex;

              return (
                <div
                  key={poster.slotIndex}
                  className={`flex flex-col rounded-xl bg-[#faf8f5] border-4 transition-all duration-200 shadow-md overflow-hidden ${
                    isHighlighted
                      ? "border-amber-600 ring-4 ring-amber-500/30 scale-[1.02]"
                      : "border-[#3f271d] hover:shadow-xl"
                  }`}
                >
                  {/* Top Gallery Slot Header */}
                  <div className="flex items-center justify-between px-3.5 py-2 bg-[#ebe6dc] border-b border-stone-300">
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-stone-900 text-stone-100 font-extrabold text-xs">
                      SLOT #{poster.badgeNumber}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-stone-600">
                      {poster.code}
                    </span>
                  </div>

                  {/* Editorial Poster Artwork Card */}
                  <div className="p-4 flex-1 flex flex-col justify-between bg-gradient-to-b from-stone-100 to-[#faf8f5]">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                          CeritaObim Studio
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            poster.status === "scheduled"
                              ? "bg-sky-100 text-sky-800 border border-sky-300"
                              : poster.status === "ready"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          }`}
                        >
                          {poster.status === "scheduled"
                            ? "Terjadwal"
                            : poster.status === "ready"
                            ? "Siap Tayang"
                            : "Published"}
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-stone-900 leading-snug line-clamp-3 mb-3">
                        {poster.title}
                      </h3>
                    </div>

                    <div className="pt-3 border-t border-stone-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                        <CalendarClock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{poster.scheduleLabel}</span>
                      </div>

                      <div className="text-[10px] font-semibold text-stone-500">
                        {poster.platforms.join(" • ")}
                      </div>

                      {poster.status !== "published" ? (
                        <button
                          onClick={() => onPublishCode(poster.code)}
                          className="w-full py-2 rounded-lg bg-[#2c1d16] hover:bg-[#3f271d] text-amber-200 font-extrabold text-[11px] uppercase tracking-wide shadow-sm transition cursor-pointer"
                        >
                          Jadwalkan / Publish ke Buffer
                        </button>
                      ) : (
                        <div className="w-full py-1.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Sudah Tayang</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Final Realistic Studio Information Plaque */}
            <div className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-stone-400 bg-[#ebe6dc]/60 text-center min-h-[240px]">
              <Layers className="w-8 h-8 text-[#3f271d] mb-2.5" />
              <p className="text-sm font-black text-stone-900 uppercase tracking-wide">
                Sinkronisasi Otomatis Buffer
              </p>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                Seluruh kartu antrean di atas terhubung langsung dengan database produksi Obim Studio dan Bot Telegram.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
