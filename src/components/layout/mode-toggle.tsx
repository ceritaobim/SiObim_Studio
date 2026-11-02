"use client";

import { useStudioMode } from "@/context/studio-mode-context";
import { Sparkles, Terminal } from "lucide-react";

export function ModeToggle() {
  const { mode, setMode } = useStudioMode();

  return (
    <div
      role="group"
      aria-label="Mode Antarmuka Studio"
      className="inline-flex items-center rounded-full bg-slate-100/90 p-1 border border-slate-200/80 shadow-2xs text-xs font-semibold"
    >
      <button
        type="button"
        onClick={() => setMode("simple")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-all ${
          mode === "simple"
            ? "bg-white text-indigo-700 shadow-xs font-bold"
            : "text-slate-500 hover:text-slate-900"
        }`}
        title="Mode Sederhana: Fokus pada ringkasan, monitoring, dan aksi 1-klik yang mudah"
      >
        <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
        <span>Simple</span>
      </button>

      <button
        type="button"
        onClick={() => setMode("advance")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-all ${
          mode === "advance"
            ? "bg-indigo-600 text-white shadow-xs font-bold"
            : "text-slate-500 hover:text-slate-900"
        }`}
        title="Mode Mahir: Buka inspektor prompt, log teknis FFmpeg, JSON data, dan kontrol detail"
      >
        <Terminal className="h-3.5 w-3.5" />
        <span>Advance</span>
      </button>
    </div>
  );
}
