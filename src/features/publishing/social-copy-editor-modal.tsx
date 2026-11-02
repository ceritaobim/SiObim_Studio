"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  Save,
  Copy,
  CheckCircle2,
  RefreshCw,
  Share2,
} from "lucide-react";
import type { ContentItemRecord } from "@/types/domain";
import type { SocialCopyTone } from "@/lib/providers/llm/social-copy-generator";

interface SocialCopyEditorModalProps {
  content: ContentItemRecord;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<ContentItemRecord>) => void;
}

export function SocialCopyEditorModal({
  content,
  isOpen,
  onClose,
  onSaved,
}: SocialCopyEditorModalProps) {
  const [activePlatform, setActivePlatform] = useState<
    "tiktok" | "youtube" | "instagram"
  >("tiktok");

  const [title, setTitle] = useState(content.title || "");
  const [hook, setHook] = useState(content.hook || "");
  const [tiktokCaption, setTiktokCaption] = useState(
    content.tiktokCaption || ""
  );
  const [youtubeDescription, setYoutubeDescription] = useState(
    content.youtubeDescription || ""
  );
  const [instagramCaption, setInstagramCaption] = useState(
    content.instagramCaption || ""
  );

  const [tone, setTone] = useState<SocialCopyTone>("viral_curiosity");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/social-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          contentId: content.id,
          tone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghasilkan copy.");
      }

      if (data.generated) {
        setTitle(data.generated.viralTitle || title);
        setHook(data.generated.hook || hook);
        setTiktokCaption(data.generated.tiktokCaption || tiktokCaption);
        setYoutubeDescription(
          data.generated.youtubeDescription || youtubeDescription
        );
        setInstagramCaption(
          data.generated.instagramCaption || instagramCaption
        );
        setFeedback({
          type: "success",
          text: "✨ Copy baru berhasil digenerate oleh Gemini AI!",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat generate copy.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/social-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          contentId: content.id,
          title,
          hook,
          tiktokCaption,
          youtubeDescription,
          instagramCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan copy.");
      }

      setFeedback({
        type: "success",
        text: "💾 Perubahan copy & caption berhasil disimpan ke database!",
      });
      onSaved({
        title,
        hook,
        tiktokCaption,
        youtubeDescription,
        instagramCaption,
      });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat menyimpan copy.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setFeedback({
      type: "success",
      text: `📋 ${label} berhasil disalin ke clipboard!`,
    });
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl border border-indigo-100 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-indigo-50 p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {content.contentCode}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  AI Social Copy &amp; Caption Studio
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Atur judul viral, hook, caption, dan hashtag untuk TikTok, YouTube, dan Instagram.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* AI Generator Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700">
                Tone Gaya Bahasa:
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as SocialCopyTone)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
              >
                <option value="viral_curiosity">
                  🔥 Penasaran &amp; Bikin Stop Scroll
                </option>
                <option value="storytelling">
                  📖 Storytelling Sains Origami
                </option>
                <option value="casual_debate">
                  💬 Santai &amp; Pancing Debat Komentar
                </option>
              </select>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateAI}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isGenerating ? "animate-spin" : ""}`}
              />
              <span>
                {isGenerating ? "Meracik Copy..." : "⚡ Generate Ulang via Gemini AI"}
              </span>
            </button>
          </div>

          {feedback && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Core Title & Hook Fields */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Judul Viral Konten:
                </label>
                <span className="text-[10px] text-slate-400">
                  {title.length} karakter
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Hook Pembuka (3 Detik Pertama):
                </label>
                <span className="text-[10px] text-slate-400">
                  {hook.length} karakter
                </span>
              </div>
              <input
                type="text"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Platform Tabs & Content Editors */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                type="button"
                onClick={() => setActivePlatform("tiktok")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activePlatform === "tiktok"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                TikTok Caption
              </button>

              <button
                type="button"
                onClick={() => setActivePlatform("youtube")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activePlatform === "youtube"
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                YouTube Shorts
              </button>

              <button
                type="button"
                onClick={() => setActivePlatform("instagram")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  activePlatform === "instagram"
                    ? "bg-purple-600 text-white shadow-2xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Instagram Reels
              </button>
            </div>

            {/* TikTok Editor */}
            {activePlatform === "tiktok" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Caption &amp; Hashtag TikTok
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(tiktokCaption, "Caption TikTok")
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={tiktokCaption}
                  onChange={(e) => setTiktokCaption(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 leading-relaxed shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                  placeholder="Caption TikTok beserta ajakan komentar dan hashtags..."
                />
              </div>
            )}

            {/* YouTube Editor */}
            {activePlatform === "youtube" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Deskripsi YouTube Shorts
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        youtubeDescription,
                        "Deskripsi YouTube Shorts"
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={youtubeDescription}
                  onChange={(e) => setYoutubeDescription(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 leading-relaxed shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                  placeholder="Deskripsi YouTube Shorts, rangkuman sains, dan tags..."
                />
              </div>
            )}

            {/* Instagram Editor */}
            {activePlatform === "instagram" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Caption Instagram Reels
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        instagramCaption,
                        "Caption Instagram Reels"
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={instagramCaption}
                  onChange={(e) => setInstagramCaption(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-800 leading-relaxed shadow-2xs focus:border-indigo-500 focus:outline-hidden"
                  placeholder="Caption Instagram Reels, micro-blogging, dan hashtags..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-indigo-50 p-4 sm:px-6 bg-slate-50/50 rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
