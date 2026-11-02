"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit2,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import type { FlowProfileAccount } from "@/lib/providers/flow-accounts-service";
import { useStudioMode } from "@/context/studio-mode-context";

interface FlowCreditSummary {
  totalAccounts: number;
  totalCredits: number;
  totalMaxCredits: number;
  overallPercentage: number;
  healthyCount: number;
  warningCount: number;
  dangerCount: number;
  estimatedVideosReady: number;
}

export function FlowCreditVisualizer() {
  const [accounts, setAccounts] = useState<FlowProfileAccount[]>([]);
  const [summary, setSummary] = useState<FlowCreditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<number>(50);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/flow-accounts");
      const data = await res.json();
      if (res.ok && data.accounts) {
        setAccounts(data.accounts);
        setSummary(data.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleStartEdit = (acc: FlowProfileAccount) => {
    setEditingIndex(acc.index);
    setEditValue(acc.credits);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleSaveEdit = async (index: number) => {
    setSavingIndex(index);
    try {
      const res = await fetch("/api/flow-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIndex: index, credits: editValue }),
      });
      const data = await res.json();
      if (res.ok && data.account) {
        setAccounts((prev) =>
          prev.map((a) => (a.index === index ? data.account : a))
        );
        // Refresh summary
        fetchAccounts();
        setEditingIndex(null);
        setFeedback(`Kredit Profil ${index} berhasil diperbarui menjadi ${editValue} / 50`);
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch {
      setFeedback("Gagal memperbarui kredit.");
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setSavingIndex(null);
    }
  };

  const getBarColor = (credits: number) => {
    if (credits >= 25) return "bg-gradient-to-r from-emerald-500 to-teal-400";
    if (credits >= 10) return "bg-gradient-to-r from-amber-500 to-yellow-400";
    return "bg-gradient-to-r from-rose-500 to-red-400";
  };

  const getBadgeStyle = (status: "healthy" | "warning" | "danger", credits: number) => {
    if (status === "healthy") {
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
        label: `Siap (${Math.floor(credits / 3)} video)`,
      };
    }
    if (status === "warning") {
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-200",
        icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
        label: "Menipis",
      };
    }
    return {
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      icon: <XCircle className="h-3.5 w-3.5 text-rose-500" />,
      label: "Habis / Limit",
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Google Flow 10-Profile Credit Monitor
                  </h3>
                  {summary && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
                      ~{summary.estimatedVideosReady} Video Siap
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-300">
                  Pantau sisa kuota kredit real-time per profil Chrome (Target Full Bar: 50 Kredit)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/70 hover:bg-indigo-600 text-white border border-indigo-400/40 transition-all shadow-xs"
              title="Buka atau sembunyikan rincian 10 profil"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span>Sembunyikan 10 Profil</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span>Lihat Detail 10 Profil Chrome</span>
                </>
              )}
            </button>

            <button
              onClick={fetchAccounts}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all disabled:opacity-50"
              title="Refresh status data kredit"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Segarkan
            </button>
          </div>
        </div>

        {/* Global Stats Overview */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-slate-300 block">Total Kredit Tersedia</span>
              <div className="text-xl font-extrabold text-white mt-0.5">
                {summary.totalCredits}{" "}
                <span className="text-xs font-normal text-slate-300">/ {summary.totalMaxCredits}</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-slate-300 block">Estimasi Video Siap</span>
              <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                ~{summary.estimatedVideosReady}{" "}
                <span className="text-xs font-normal text-slate-300">Video Final</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-slate-300 block">Akun Siap Produksi</span>
              <div className="text-xl font-extrabold text-emerald-400 mt-0.5">
                {summary.healthyCount}{" "}
                <span className="text-xs font-normal text-slate-300">/ 10 Profil</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <span className="text-[11px] text-slate-300 block">Akun Kritis / Habis</span>
              <div className="text-xl font-extrabold text-rose-400 mt-0.5">
                {summary.dangerCount}{" "}
                <span className="text-xs font-normal text-slate-300">Profil</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs px-5 py-2 font-medium flex items-center justify-between">
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid 10 Profil (Expandable / Visible by Default) */}
      {isExpanded && (
        <>
          <div className="p-5 sm:p-6 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const barPct = Math.min(100, Math.round((acc.credits / 50) * 100));
                const badge = getBadgeStyle(acc.status, acc.credits);
                const isEditing = editingIndex === acc.index;

                return (
                  <div
                    key={acc.index}
                    className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                            #{acc.index}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-800 leading-tight">
                              Profil {acc.index}{" "}
                              <span className="text-xs font-normal text-slate-500">
                                ({acc.dirName})
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono truncate max-w-[200px] sm:max-w-[240px]">
                              {acc.email || acc.name}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                      </div>

                      {/* Visual Bar Credit */}
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600 flex items-center gap-1">
                            Sisa Kredit:
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="500"
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value, 10) || 0)}
                                className="w-16 px-1.5 py-0.5 text-xs font-bold text-slate-900 border border-indigo-400 rounded focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEdit(acc.index)}
                                disabled={savingIndex === acc.index}
                                className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                                title="Simpan"
                              >
                                <Check className="h-3 w-3" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                                title="Batal"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 font-extrabold text-sm">
                                {acc.credits} / 50
                              </span>
                              <button
                                onClick={() => handleStartEdit(acc)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors p-0.5"
                                title="Edit kredit manual"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar Container */}
                        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getBarColor(
                              acc.credits
                            )}`}
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Kapasitas: ~{Math.floor(acc.credits / 3)} video (3 bagian/konten)
                      </span>
                      <span>{barPct}% Terisi</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Info Box */}
          <div className="p-4 bg-slate-100/70 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                Jalankan <b>Menu [5]</b> di <code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono font-bold text-slate-800">Jalankan_Makro_Otomasi.bat</code> untuk membuka otomatis ke-10 profil Chrome & mencatat sisa kredit secara real-time.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
