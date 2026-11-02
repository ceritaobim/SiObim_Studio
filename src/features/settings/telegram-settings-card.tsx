"use client";

import { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Bot,
  Save,
  HelpCircle,
  Terminal,
} from "lucide-react";

export function TelegramSettingsCard() {
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/test");
      const data = await res.json();
      if (res.ok) {
        setIsConfigured(data.configured);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSave = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      setFeedback({
        type: "error",
        text: "Bot Token dan Chat ID wajib diisi.",
      });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          token: botToken,
          chatId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi.");
      }

      setIsConfigured(true);
      setFeedback({
        type: "success",
        text: "💾 Konfigurasi bot Telegram berhasil disimpan ke sistem!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat menyimpan token.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          token: botToken || undefined,
          chatId: chatId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan uji coba.");
      }

      setFeedback({
        type: "success",
        text: data.message || "Pesan tes berhasil dikirim ke Telegram!",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat tes Telegram.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-50 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-2xs">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900">
                Pusat Kontrol &amp; Notifikasi Bot Telegram
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                  isConfigured
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {isConfigured ? "● Terhubung" : "Belum Dikonfigurasi"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Kendalikan studio dan pantau video master <strong>00Final.mp4</strong> langsung dari smartphone Anda.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>{showGuide ? "Tutup Panduan" : "Panduan Buat Bot (1 Menit)"}</span>
        </button>
      </div>

      {/* Guide Dropdown */}
      {showGuide && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 text-xs text-sky-950 space-y-2">
          <p className="font-bold">Langkah Cepat Membuat Bot Telegram Gratis:</p>
          <ol className="list-decimal list-inside space-y-1 text-sky-900 pl-1">
            <li>
              Buka aplikasi Telegram, cari <strong>@BotFather</strong>, lalu ketik{" "}
              <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">
                /newbot
              </code>
              .
            </li>
            <li>
              Beri nama bot (contoh: <code>CeritaObim Studio Bot</code>), lalu salin{" "}
              <strong>HTTP API Token</strong> yang diberikan.
            </li>
            <li>
              Cari <strong>@userinfobot</strong> di Telegram dan kirim pesan apapun untuk melihat angka{" "}
              <strong>Id</strong> Anda (contoh: <code>123456789</code>).
            </li>
            <li>
              Tempelkan token dan ID tersebut ke form di bawah ini, lalu klik{" "}
              <strong>Simpan &amp; Tes Kirim Pesan</strong>.
            </li>
          </ol>
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-xs font-semibold shadow-xs ${
            feedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Form Inputs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">
            Telegram Bot Token:
          </label>
          <input
            type="password"
            placeholder="Contoh: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">
            Telegram Chat ID (Akun Anda):
          </label>
          <input
            type="text"
            placeholder="Contoh: 987654321"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-mono text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Terminal className="h-3.5 w-3.5 text-indigo-600" />
          <span>Perintah Siap Pakai: <code>/status</code>, <code>/publish CO-2026-001</code>, <code>/ping</code></span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={testing}
            onClick={handleTest}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-50 transition-colors shadow-2xs"
          >
            <Send className={`h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
            <span>{testing ? "Mengirim..." : "🧪 Tes Kirim Pesan ke HP"}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
