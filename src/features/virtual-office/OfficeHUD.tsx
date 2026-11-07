"use client";

import React, { useState, useEffect } from "react";
import {
  Coffee,
  Zap,
  BatteryCharging,
  RotateCcw,
  Sparkles,
  Users,
  Maximize,
  Minimize,
  Sun,
  Sunset,
  Moon,
  Gamepad2,
  Radio,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Film,
} from "lucide-react";
import { CameraPreset, LightingMode, OfficeMember } from "./types";
import { CAMERA_PRESETS } from "./constants";
import type { VirtualOfficeEvent } from "@/lib/services/virtual-office-sync";

interface OfficeHUDProps {
  members: OfficeMember[];
  lightingMode: LightingMode;
  onChangeLighting: (mode: LightingMode) => void;
  onSelectPreset: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onSimulateBatchRender: () => void;
  onRefillAll: () => void;
  onSendExhaustedToLounge: () => void;
  propToast: string | null;
  cameraFollowPlayer: boolean; // True = Third-Person Game Mode
  onToggleCameraFollow: () => void;
  onOpenBufferModal: () => void;
  recentEvents: VirtualOfficeEvent[];
  onVirtualMoveChange: (input: { dx: number; dz: number; sprint: boolean }) => void;
}

export function OfficeHUD({
  members,
  lightingMode,
  onChangeLighting,
  onSelectPreset,
  onResetCamera,
  onSimulateBatchRender,
  onRefillAll,
  onSendExhaustedToLounge,
  propToast,
  cameraFollowPlayer,
  onToggleCameraFollow,
  onOpenBufferModal,
  recentEvents,
  onVirtualMoveChange,
}: OfficeHUDProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSyncFeed, setShowSyncFeed] = useState(false);
  const [sprintToggle, setSprintToggle] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore if blocked by browser policy
    }
  };

  const videoEditors = members.filter((m) => m.teamId === "video-prod" && !m.isLead);
  const restingCount = videoEditors.filter((m) => m.status === "resting").length;
  const standbyCount = videoEditors.filter((m) => m.status === "standby").length;
  const totalCredits = videoEditors.reduce((sum, m) => sum + m.credits, 0);

  const startMove = (dx: number, dz: number) => {
    onVirtualMoveChange({ dx, dz, sprint: sprintToggle });
  };

  const stopMove = () => {
    onVirtualMoveChange({ dx: 0, dz: 0, sprint: false });
  };

  return (
    <>
      {/* TOP GAME-STYLE FLOATING HUD */}
      <div className="absolute top-3 inset-x-3 z-40 pointer-events-none flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-700/60 shadow-2xl pointer-events-auto">
          {/* Left: Studio Brand + Live Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    Obim Studio 3D World
                  </h1>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {cameraFollowPlayer ? "3rd-Person Game Mode" : "Top-Down Overview"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Users className="w-3 h-3 text-indigo-400" />
                    11 Profil Chrome
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-semibold">
                    {standbyCount} Kerja di Meja
                  </span>
                  <span>•</span>
                  <span
                    className={
                      restingCount > 0 ? "text-rose-400 font-bold" : "text-slate-400"
                    }
                  >
                    {restingCount} Istirahat di Lounge
                  </span>
                  <span>•</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {totalCredits} Kuota
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Dedicated Game Mode Button + Buffer Corridor + Simulation + Sync Log + Lighting */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* DEDICATED PLAYABLE THIRD-PERSON GAME MODE BUTTON */}
            <button
              onClick={onToggleCameraFollow}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-extrabold shadow-md transition border active:scale-95 cursor-pointer ${
                cameraFollowPlayer
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 border-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.45)]"
                  : "bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border-amber-500/50"
              }`}
              title="Masuk/Keluar Mode Game Third-Person (Kamera di belakang karakter CEO Obim + Body Block aktif)"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>
                {cameraFollowPlayer
                  ? "🎮 Mode Game (3rd Person): AKTIF"
                  : "🎮 Masuk Mode Game (3rd Person)"}
              </span>
            </button>

            {/* BUFFER CINEMA SCHEDULE CORRIDOR BUTTON */}
            <button
              onClick={onOpenBufferModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-rose-600 hover:from-cyan-500 hover:to-rose-500 text-white font-bold shadow-sm transition border border-cyan-400/50 active:scale-95 cursor-pointer"
              title="Buka Jadwal Tayang Publisher Buffer (Koridor Bioskop)"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Jadwal Buffer</span>
            </button>

            <button
              onClick={onSimulateBatchRender}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition border border-indigo-400/40 active:scale-95 cursor-pointer"
              title="Simulasi Render 1 Klip (-10 Kuota di Database)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Render Klip</span>
            </button>

            <button
              onClick={onRefillAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm transition border border-emerald-400/40 active:scale-95 cursor-pointer"
              title="Isi Kuota Semua Editor (+50 di Database) & Panggil Kembali ke Meja"
            >
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-100" />
              <span>Refill Semua</span>
            </button>

            <button
              onClick={onSendExhaustedToLounge}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-sm transition border border-amber-400/40 active:scale-95 cursor-pointer"
              title="Suruh Editor Istirahat Jalan ke Lounge Warkop"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-100" />
              <span>Ke Lounge</span>
            </button>

            {/* Live Telegram & Studio Sync Feed Toggle */}
            <button
              onClick={() => setShowSyncFeed(!showSyncFeed)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition border active:scale-95 cursor-pointer ${
                showSyncFeed
                  ? "bg-sky-600 text-white border-sky-400"
                  : "bg-slate-800 hover:bg-slate-700 text-sky-300 border-sky-500/40"
              }`}
              title="Lihat Log Sinkronisasi Real-Time (Telegram <-> Kantor 3D <-> Studio)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden md:inline">Sync Log</span>
              {recentEvents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/30 text-[10px]">
                  {recentEvents.length}
                </span>
              )}
            </button>

            {/* Lighting Mode Switcher (Day / Sunset / Night) */}
            <div className="flex items-center rounded-xl bg-slate-900/90 p-0.5 border border-slate-700">
              <button
                onClick={() => onChangeLighting("day")}
                title="Suasana Siang"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  lightingMode === "day"
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onChangeLighting("sunset")}
                title="Suasana Sore Golden Hour"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  lightingMode === "sunset"
                    ? "bg-orange-500 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onChangeLighting("night")}
                title="Suasana Malam Cyber Studio"
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  lightingMode === "night"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onResetCamera}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition border border-slate-600/60 active:scale-95 cursor-pointer"
              title="Keluar Mode Game & Kembali ke Kamera Tampak Atas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tampak Atas</span>
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold transition border border-amber-500/40 active:scale-95 cursor-pointer"
              title="Layar Penuh (Fullscreen Game Mode)"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">
                {isFullscreen ? "Exit" : "Fullscreen"}
              </span>
            </button>
          </div>
        </div>

        {/* Camera Room Preset Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pointer-events-auto">
          {CAMERA_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/75 hover:bg-slate-800 backdrop-blur-md text-slate-200 border border-slate-700/60 shadow-md transition active:scale-95 cursor-pointer font-medium"
            >
              <span>{preset.label}</span>
            </button>
          ))}
        </div>

        {/* LIVE BIDIRECTIONAL SYNC FEED DRAWER */}
        {showSyncFeed && (
          <div className="self-end w-full max-w-md rounded-2xl bg-slate-950/90 backdrop-blur-md border border-sky-500/40 shadow-2xl p-3 text-xs text-slate-200 pointer-events-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sky-300">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Log Sinkronisasi Real-Time (Telegram ↔ 3D ↔ Buffer)</span>
              </div>
              <button
                onClick={() => setShowSyncFeed(false)}
                className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
              >
                Tutup
              </button>
            </div>
            {recentEvents.length === 0 ? (
              <p className="text-slate-400 text-[11px] py-2">
                Belum ada aktivitas terbaru. Coba kirim perintah dari Bot Telegram atau ajak bicara karakter di kantor!
              </p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded ${
                          ev.source === "telegram"
                            ? "bg-sky-500/20 text-sky-300"
                            : ev.source === "virtual-office"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {ev.source === "telegram"
                          ? "📲 Telegram Bot"
                          : ev.source === "virtual-office"
                          ? "🎮 Virtual Office"
                          : "⚙️ Studio System"}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {new Date(ev.timestamp).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-100 font-semibold mt-0.5">{ev.summary}</p>
                    {ev.speechBubble && (
                      <p className="text-slate-400 text-[11px] truncate">
                        💬 {ev.speechBubble}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ON-SCREEN VIRTUAL GAMEPAD / D-PAD FOR PLAYABLE CEO CHARACTER (Bottom-Left) */}
      <div className="fixed bottom-4 left-4 z-40 flex items-end gap-3 select-none">
        <div className="p-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-700/70 shadow-2xl flex flex-col items-center gap-1">
          <div className="text-[10px] font-bold text-amber-300 flex items-center gap-1 mb-0.5">
            <Gamepad2 className="w-3 h-3" />
            <span>CEO Obim (WASD / Klik Lantai)</span>
          </div>

          <button
            onMouseDown={() => startMove(0, -1)}
            onMouseUp={stopMove}
            onMouseLeave={stopMove}
            onTouchStart={() => startMove(0, -1)}
            onTouchEnd={stopMove}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 active:scale-90 text-slate-200 flex items-center justify-center border border-slate-600/60 transition cursor-pointer"
            title="Jalan Maju (W / Panah Atas)"
          >
            <ChevronUp className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            <button
              onMouseDown={() => startMove(-1, 0)}
              onMouseUp={stopMove}
              onMouseLeave={stopMove}
              onTouchStart={() => startMove(-1, 0)}
              onTouchEnd={stopMove}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 active:scale-90 text-slate-200 flex items-center justify-center border border-slate-600/60 transition cursor-pointer"
              title="Belok / Geser Kiri (A / Panah Kiri)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              onClick={() => setSprintToggle(!sprintToggle)}
              className={`w-9 h-9 rounded-xl text-[10px] font-extrabold flex flex-col items-center justify-center border transition cursor-pointer ${
                sprintToggle
                  ? "bg-amber-500 text-slate-950 border-amber-300"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Toggle Lari Cepat (Shift)"
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>{sprintToggle ? "RUN" : "WALK"}</span>
            </button>

            <button
              onMouseDown={() => startMove(1, 0)}
              onMouseUp={stopMove}
              onMouseLeave={stopMove}
              onTouchStart={() => startMove(1, 0)}
              onTouchEnd={stopMove}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 active:scale-90 text-slate-200 flex items-center justify-center border border-slate-600/60 transition cursor-pointer"
              title="Belok / Geser Kanan (D / Panah Kanan)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onMouseDown={() => startMove(0, 1)}
            onMouseUp={stopMove}
            onMouseLeave={stopMove}
            onTouchStart={() => startMove(0, 1)}
            onTouchEnd={stopMove}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 active:scale-90 text-slate-200 flex items-center justify-center border border-slate-600/60 transition cursor-pointer"
            title="Jalan Mundur (S / Panah Bawah)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* INTERACTIVE PROP NOTIFICATION TOAST */}
        {propToast && (
          <div className="max-w-md px-4 py-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-amber-500/50 text-amber-200 text-xs font-semibold shadow-2xl animate-bounce">
            {propToast}
          </div>
        )}
      </div>
    </>
  );
}
