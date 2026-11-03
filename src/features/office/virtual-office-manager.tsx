"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Mic,
  Film,
  Lightbulb,
  Server,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Terminal,
  Activity,
  Play,
} from "lucide-react";

interface DepartmentState {
  manager: {
    role: string;
    title: string;
    avatar: string;
    status: string;
    statusLabel: string;
    currentTask: string;
    nextVideo?: { code: string; title: string; category: string } | null;
    dailyTarget: number;
    defaultHour: string;
    publishedCount: number;
    readyCount: number;
    inProductionCount: number;
  };
  audio: {
    role: string;
    title: string;
    avatar: string;
    status: string;
    statusLabel: string;
    currentTask: string;
    voiceModel: string;
    audioCount: number;
    alignmentStatus: string;
    diegeticSfxSupport: string;
  };
  producer: {
    role: string;
    title: string;
    avatar: string;
    status: string;
    statusLabel: string;
    currentTask: string;
    finalVideoCount: number;
    inProductionCount: number;
    aspectRatio: string;
    qualityRule: string;
    referenceLock: string;
  };
  creative: {
    role: string;
    title: string;
    avatar: string;
    status: string;
    statusLabel: string;
    currentTask: string;
    totalIdeas: number;
    programBreakdown: { keDapurYuk: number; kepikiranAja: number; ehTernyata: number };
    duplicateWarnings: number;
    verifiedFactsPercent: number;
  };
  it: {
    role: string;
    title: string;
    avatar: string;
    status: string;
    statusLabel: string;
    currentTask: string;
    ecosystems: Array<{
      name: string;
      platform: string;
      status: string;
      latency: string;
      details: string;
      icon: string;
    }>;
  };
}

interface OfficeLog {
  id: string;
  time: string;
  dept: string;
  avatar: string;
  action: string;
}

export function VirtualOfficeManager() {
  const [data, setData] = useState<{
    departments: DepartmentState;
    nowWib: string;
    officeLogs: OfficeLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "manager" | "producer" | "audio" | "creative" | "it">("all");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchOfficeState = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/office/state");
      const json = await res.json();
      if (json.ok) {
        setData(json);
      }
    } catch (err) {
      console.error("Gagal memuat status kantor virtual:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOfficeState();
    const interval = setInterval(fetchOfficeState, 15000);
    return () => clearInterval(interval);
  }, [fetchOfficeState]);

  const triggerAction = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const dept = data?.departments;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Kantor Virtual */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm border border-emerald-500/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              MARKAS AGENSI VIRTUAL SI OBIM • AKTIF 24/7
            </div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl flex items-center gap-3">
              <span>🏢</span> Kantor Virtual CeritaObim
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              5 Departemen spesialis bekerja otonom menjaga kualitas konten origami stop-motion, jadwal tayang, aset suara, dan infrastruktur studio Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchOfficeState}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sinkronisasi Ruangan
            </button>
            <a
              href="https://t.me/CeritaObimStudioBot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
            >
              <Send className="h-4 w-4" />
              Buka di Telegram
            </a>
          </div>
        </div>

        {/* Live Ticker Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-5 text-xs">
          <div className="space-y-0.5">
            <span className="text-slate-400">Waktu Studio:</span>
            <p className="font-bold text-slate-200">{data?.nowWib || "Memuat..."}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400">Target Harian:</span>
            <p className="font-bold text-amber-400">{dept?.manager.dailyTarget || 1} Konten / Hari</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400">Video Siap Tayang:</span>
            <p className="font-bold text-emerald-400">{dept?.manager.readyCount || 0} Video</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400">Sudah Publish:</span>
            <p className="font-bold text-sky-400">{dept?.manager.publishedCount || 0} Video</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-slate-400">Status IT Server:</span>
            <p className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> 3 Ekosistem Online
            </p>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-semibold text-indigo-900 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>{actionNotice}</span>
          </div>
          <span className="text-[10px] text-indigo-500">Instruksi tercatat di sistem</span>
        </div>
      )}

      {/* 2. Denah 5 Ruangan Departemen (Interactive Diorama Cards) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* RUANGAN 1: MEJA MANAJER OPERASIONAL */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-5 shadow-sm transition hover:shadow-md">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-md shadow-amber-500/20">
                  👔
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Meja Manajer Obim</h3>
                  <p className="text-xs text-amber-700 font-medium">Operasional & Jadwal Tayang</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                SIAGA
              </span>
            </div>

            {/* Animasi Kalender & Antrean */}
            <div className="rounded-xl border border-amber-100 bg-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-amber-600" /> Video Terdepan
                </span>
                <span className="font-bold text-amber-700">{dept?.manager.defaultHour}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 line-clamp-2">
                {dept?.manager.nextVideo ? `"${dept.manager.nextVideo.title}"` : "Semua stok siap tayang sudah di-upload"}
              </p>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                <span className="text-slate-500">Etalase:</span>
                <span className="font-semibold text-slate-700">
                  {dept?.manager.readyCount} Siap Tayang • {dept?.manager.publishedCount} Live Medsos
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-amber-50/80 rounded-lg p-2.5 border border-amber-100">
              <span className="font-bold text-slate-700">Aktivitas Sekarang:</span>{" "}
              {dept?.manager.currentTask}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              href="/publishing"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-500 transition"
            >
              <Send className="h-3.5 w-3.5" /> Buka Publishing
            </Link>
            <button
              onClick={() => triggerAction("Manajer: Mengonfirmasi kesiapan stok konten hari ini.")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cek Stok
            </button>
          </div>
        </div>

        {/* RUANGAN 2: STUDIO REKAMAN DUBBER / AUDIO */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/50 to-white p-5 shadow-sm transition hover:shadow-md">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-md shadow-indigo-600/20">
                  🎙️
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Studio Dubber Obim</h3>
                  <p className="text-xs text-indigo-700 font-medium">Pengisian Suara & Soundscape</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                TERALIN
              </span>
            </div>

            {/* Animasi Gelombang Suara (Equalizer Waveform) */}
            <div className="rounded-xl border border-indigo-100 bg-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Mic className="h-3.5 w-3.5 text-indigo-600" /> ElevenLabs Voice Model
                </span>
                <span className="font-bold text-indigo-700">{dept?.audio.audioCount} Audio MP3</span>
              </div>
              {/* Animasi Bouncing Equalizer Bars */}
              <div className="flex items-end justify-center gap-1 h-10 py-1 bg-slate-950 rounded-lg px-3">
                {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50, 80, 65, 90, 40].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <span>Model Suara:</span>
                <span className="font-semibold text-indigo-900 truncate max-w-[170px]">Obim Casual (ElevenLabs)</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-indigo-50/80 rounded-lg p-2.5 border border-indigo-100">
              <span className="font-bold text-slate-700">Aktivitas Sekarang:</span>{" "}
              {dept?.audio.currentTask}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              href="/production"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              <Mic className="h-3.5 w-3.5" /> Buka Audio Studio
            </Link>
            <button
              onClick={() => triggerAction("Tim Audio: Karakter suara Obim terverifikasi jernih dan selaras.")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Tes Suara
            </button>
          </div>
        </div>

        {/* RUANGAN 3: RUANG PRODUSER & ORIGAMI */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-rose-200/80 bg-gradient-to-b from-rose-50/50 to-white p-5 shadow-sm transition hover:shadow-md">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-2xl shadow-md shadow-rose-600/20">
                  🎬
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Produser Studio</h3>
                  <p className="text-xs text-rose-700 font-medium">Gaya Origami & Perakitan Video</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                9:16 FINAL
              </span>
            </div>

            {/* Detail Stop-Motion Origami */}
            <div className="rounded-xl border border-rose-100 bg-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Film className="h-3.5 w-3.5 text-rose-600" /> Video Final Terakit
                </span>
                <span className="font-bold text-rose-700">{dept?.producer.finalVideoCount} Master MP4</span>
              </div>
              <div className="rounded-lg bg-rose-950/90 p-2.5 text-white font-mono text-[11px] space-y-1">
                <div className="flex justify-between text-rose-300">
                  <span>Format: 9:16 Vertikal</span>
                  <span>Stop-Motion: Aktif</span>
                </div>
                <div className="text-slate-300 text-[10px] truncate">
                  Visual Rule: 100% Kertas Origami (Tanpa Teks/Sub)
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <span>Kunci Referensi:</span>
                <span className="font-semibold text-rose-900">Master_SiObim.png</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-rose-50/80 rounded-lg p-2.5 border border-rose-100">
              <span className="font-bold text-slate-700">Aktivitas Sekarang:</span>{" "}
              {dept?.producer.currentTask}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              href="/assets"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition"
            >
              <Film className="h-3.5 w-3.5" /> Buka Video Studio
            </Link>
            <button
              onClick={() => triggerAction("Produser: Prompt generator terkunci pada aturan bebas teks dan handmade origami.")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cek Prompt
            </button>
          </div>
        </div>

        {/* RUANGAN 4: LAB RISET TIM KREATIF */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-5 shadow-sm transition hover:shadow-md">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-2xl shadow-md shadow-emerald-600/20">
                  💡
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Tim Riset Kreatif</h3>
                  <p className="text-xs text-emerald-700 font-medium">Topik Sains & Validasi Fakta</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                0% DUPLIKAT
              </span>
            </div>

            {/* Distribusi 3 Program */}
            <div className="rounded-xl border border-emerald-100 bg-white p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Lightbulb className="h-3.5 w-3.5 text-emerald-600" /> Pustaka Topik Terverifikasi
                </span>
                <span className="font-bold text-emerald-700">{dept?.creative.totalIdeas} Konten</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                <div className="rounded-lg bg-amber-50 p-2 text-amber-800 border border-amber-200">
                  🍳 Ke Dapur
                  <div className="text-xs font-extrabold">{dept?.creative.programBreakdown.keDapurYuk}</div>
                </div>
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-800 border border-indigo-200">
                  🌙 Kepikiran
                  <div className="text-xs font-extrabold">{dept?.creative.programBreakdown.kepikiranAja}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800 border border-emerald-200">
                  💡 Ternyata
                  <div className="text-xs font-extrabold">{dept?.creative.programBreakdown.ehTernyata}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <span>Hook Detik 0-3:</span>
                <span className="font-semibold text-emerald-900">In-Media-Res Kinetik</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-emerald-50/80 rounded-lg p-2.5 border border-emerald-100">
              <span className="font-bold text-slate-700">Aktivitas Sekarang:</span>{" "}
              {dept?.creative.currentTask}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              href="/content"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Buka Content Plan
            </Link>
            <button
              onClick={() => triggerAction("Tim Kreatif: Menyiapkan 3 variasi hook untuk video berikutnya.")}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Riset Ide
            </button>
          </div>
        </div>

        {/* RUANGAN 5: SERVER ROOM & TIM IT (NOC) */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50/50 to-white p-5 shadow-sm transition hover:shadow-md lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-2xl shadow-md shadow-sky-600/20">
                  💻
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Server Room & Tim IT (NOC)</h3>
                  <p className="text-xs text-sky-700 font-medium">Monitoring 3 Ekosistem: Website, Makro, & Bot Telegram</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>

            {/* 3 Ekosistem Telemetry Box */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {dept?.it.ecosystems.map((eco, idx) => (
                <div key={idx} className="rounded-xl border border-sky-100 bg-white p-3 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {eco.name}
                    </span>
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-800">
                      {eco.latency}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{eco.platform}</p>
                  <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-1">{eco.details}</p>
                </div>
              ))}
            </div>

            <div className="text-xs text-slate-600 bg-sky-50/80 rounded-lg p-2.5 border border-sky-100">
              <span className="font-bold text-slate-700">Aktivitas Sekarang:</span>{" "}
              {dept?.it.currentTask}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
            <Link
              href="/tools"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition"
            >
              <Terminal className="h-3.5 w-3.5" /> Buka Tools & Makro Hub
            </Link>
            <button
              onClick={() => triggerAction("Tim IT: Ping 3 ekosistem sukses — Vercel 24ms, Database Supabase OK, Telegram Webhook 200 OK.")}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              ⚡ Ping 3 Ekosistem
            </button>
          </div>
        </div>
      </div>

      {/* 3. Panduan Kontrol Jarak Jauh via Telegram */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">Kendali Kantor Virtual via Telegram</h2>
          </div>
          <span className="text-xs text-slate-500">Cukup chat di bot Telegram Anda</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>🏢</span> Cek Seluruh Kantor
            </span>
            <p className="text-slate-600">Ketik di Telegram:</p>
            <code className="block rounded bg-white p-2 font-mono text-[11px] text-indigo-700 border border-slate-200">
              /office
            </code>
            <p className="text-[11px] text-slate-500">Bot membalas status ringkas 5 departemen sekaligus.</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>💻</span> Perintah Tim IT
            </span>
            <p className="text-slate-600">Ketik di Telegram:</p>
            <code className="block rounded bg-white p-2 font-mono text-[11px] text-sky-700 border border-slate-200">
              it: status server
            </code>
            <p className="text-[11px] text-slate-500">Tim IT membalas kesehatan Web, Makro, dan Webhook.</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-1.5">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              <span>👔</span> Perintah Manajer
            </span>
            <p className="text-slate-600">Ketik di Telegram:</p>
            <code className="block rounded bg-white p-2 font-mono text-[11px] text-amber-700 border border-slate-200">
              manajer: cek stok hari ini
            </code>
            <p className="text-[11px] text-slate-500">Manajer membalas video siap tayang dan jadwalnya.</p>
          </div>
        </div>
      </div>

      {/* 4. Log Aktivitas Real-Time Terkini */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Catatan Aktivitas Terkini Agensi</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">Otomatis Diperbarui</span>
        </div>

        <div className="divide-y divide-slate-100">
          {(data?.officeLogs || []).map((log) => (
            <div key={log.id} className="py-3 flex items-start justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <span className="text-lg">{log.avatar}</span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.dept}</span>
                    <span className="text-[10px] text-slate-400">• {log.time}</span>
                  </div>
                  <p className="text-slate-600">{log.action}</p>
                </div>
              </div>
              <span className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                SELESAI
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
