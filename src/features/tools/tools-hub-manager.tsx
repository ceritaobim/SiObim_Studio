"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Bot,
  Mic,
  Film,
  Send,
  FolderSync,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
} from "lucide-react";
import { useStudioMode } from "@/context/studio-mode-context";

interface ToolItem {
  name: string;
  status: "healthy" | "warning" | "error";
  message: string;
  details?: Record<string, unknown>;
}

export function ToolsHubManager() {
  const { isAdvance } = useStudioMode();
  const [tools, setTools] = useState<Record<string, ToolItem>>({});
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tools/health");
      const data = await res.json();
      if (res.ok && data.tools) {
        setTools(data.tools);
        setLastCheck(new Date().toLocaleTimeString("id-ID"));
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const TOOL_ICONS: Record<string, React.ReactNode> = {
    gemini: <Sparkles className="h-5 w-5 text-indigo-600" />,
    elevenlabs: <Mic className="h-5 w-5 text-amber-600" />,
    buffer: <Send className="h-5 w-5 text-blue-600" />,
    gdrive: <FolderSync className="h-5 w-5 text-emerald-600" />,
    ffmpeg: <Cpu className="h-5 w-5 text-purple-600" />,
    macro: <Bot className="h-5 w-5 text-indigo-600" />,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-indigo-100 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-2xs">
              <Wrench className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              Pusat Diagnosa Tools &amp; Integrasi
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pantau status koneksi, kuota, dan kinerja 6 engine utama CeritaObim Studio dalam satu layar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-[11px] font-medium text-slate-400">
              Dicek: {lastCheck}
            </span>
          )}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Tes Diagnosa Sekarang</span>
          </button>
        </div>
      </div>

      {/* Grid of Tools Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(tools).map(([key, item]) => {
          const isHealthy = item.status === "healthy";
          const isWarning = item.status === "warning";

          return (
            <div
              key={key}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-2xs">
                    {TOOL_ICONS[key] || <Wrench className="h-5 w-5 text-slate-600" />}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                      isHealthy
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : isWarning
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {isHealthy ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                    )}
                    <span>{isHealthy ? "Aktif & Normal" : "Perlu Dicek"}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 font-medium">
                    {item.message}
                  </p>
                </div>

                {isAdvance && item.details && (
                  <div className="rounded-xl bg-slate-50 p-2.5 font-mono text-[11px] text-slate-600 border border-slate-100 space-y-0.5 overflow-x-auto">
                    {Object.entries(item.details).map(([dKey, dVal]) => (
                      <div key={dKey} className="flex justify-between gap-2">
                        <span className="text-slate-400">{dKey}:</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {String(dVal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                {key === "buffer" && (
                  <Link
                    href="/publishing"
                    className="font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Buka Menu Publishing &rarr;
                  </Link>
                )}
                {key === "macro" && (
                  <Link
                    href="/assets"
                    className="font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Buka Video Studio &rarr;
                  </Link>
                )}
                {key === "elevenlabs" && (
                  <Link
                    href="/production"
                    className="font-bold text-amber-700 hover:text-amber-900"
                  >
                    Buka Audio Studio &rarr;
                  </Link>
                )}
                {key === "gemini" && (
                  <Link
                    href="/content"
                    className="font-bold text-indigo-600 hover:text-indigo-800"
                  >
                    Buka Content Plan &rarr;
                  </Link>
                )}
                {key === "gdrive" && (
                  <Link
                    href="/settings"
                    className="font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Buka Pengaturan Drive &rarr;
                  </Link>
                )}
                {key === "ffmpeg" && (
                  <Link
                    href="/settings"
                    className="font-bold text-purple-700 hover:text-purple-900"
                  >
                    Pengaturan Server &rarr;
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
