"use client";

import { useState, type FormEvent } from "react";
import {
  Sparkles,
  Download,
  Upload,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Film,
  CheckSquare,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import type {
  AssetRecord,
  ContentItemRecord,
  SceneRecord,
} from "@/types/domain";
import type { ClipCompletenessReport } from "@/features/video-generation/clip-matcher";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface SceneFlowManagerProps {
  initialItems: ContentItemRecord[];
  initialSelectedContent: ContentItemRecord | null;
  initialScenes: SceneRecord[];
  initialAssets: AssetRecord[];
  initialCompleteness: ClipCompletenessReport;
}

export function SceneFlowManager({
  initialItems,
  initialSelectedContent,
  initialScenes,
  initialAssets,
  initialCompleteness,
}: SceneFlowManagerProps) {
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [selectedContentId, setSelectedContentId] = useState<string>(
    initialSelectedContent?.id ?? initialItems[0]?.id ?? ""
  );
  const [selectedContent, setSelectedContent] =
    useState<ContentItemRecord | null>(initialSelectedContent);
  const [scenes, setScenes] = useState<SceneRecord[]>(initialScenes);
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets);
  const [completeness, setCompleteness] =
    useState<ClipCompletenessReport>(initialCompleteness);

  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [uploadingClips, setUploadingClips] = useState(false);
  const [assemblingVideo, setAssemblingVideo] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manualSceneId, setManualSceneId] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [assemblyLogText, setAssemblyLogText] = useState<string>("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const handleSelectContent = async (contentId: string) => {
    setSelectedContentId(contentId);
    setFeedback(null);
    setSelectedFiles([]);
    setManualSceneId("");
    setAssemblyLogText("");

    try {
      const res = await fetch(
        `/api/scenes?contentId=${encodeURIComponent(contentId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setSelectedContent(data.selectedContent);
        setScenes(data.scenes ?? []);
        setAssets(data.assets ?? []);
        setCompleteness(data.completeness);
      }
    } catch {
      // ignore error
    }
  };

  const handleGeneratePrompts = async () => {
    if (!selectedContentId) return;
    setGeneratingPrompts(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: selectedContentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat paket prompt scene.");
      }

      setScenes(data.scenes ?? []);
      setAssets(data.assets ?? []);
      setCompleteness(data.completeness);
      setFeedback({
        type: "success",
        text: `Berhasil menyusun ${data.scenes.length} prompt origami stop-motion beserta target nama file deterministik.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal membuat paket prompt scene.",
      });
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const handleUploadClips = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0 || !selectedContentId) return;
    setUploadingClips(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("contentId", selectedContentId);
      if (manualSceneId) {
        formData.append("sceneId", manualSceneId);
      }
      formData.append("replaceExisting", String(replaceExisting));
      for (const f of selectedFiles) {
        formData.append("files", f);
      }

      const res = await fetch("/api/scenes", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengunggah klip scene.");
      }

      setScenes(data.scenes ?? []);
      setAssets(data.assets ?? []);
      setCompleteness(data.completeness);
      setSelectedFiles([]);
      setFeedback({
        type: "success",
        text: `${data.matchSummary.length} klip berhasil diunggah dan dipetakan ke scene.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal mengunggah klip scene.",
      });
    } finally {
      setUploadingClips(false);
    }
  };

  const handleRunAssembly = async () => {
    if (!selectedContentId) return;
    setAssemblingVideo(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: selectedContentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal merakit video master 9:16.");
      }

      setAssets((prev) => [
        data.finalVideoAsset,
        data.assemblyLogAsset,
        ...prev.filter(
          (a) =>
            a.assetType !== "final_video" && a.assetType !== "assembly_log"
        ),
      ]);
      setAssemblyLogText(data.logText ?? "");
      setFeedback({
        type: "success",
        text: `Video Master 9:16 (${data.finalVideoAsset.originalFilename}) berhasil dirakit tanpa subtitle dan tanpa watermark!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal merakit video master 9:16.",
      });
    } finally {
      setAssemblingVideo(false);
    }
  };

  const sceneClipAssets = assets.filter((a) => a.assetType === "scene_video");
  const finalVideoAsset = assets.find((a) => a.assetType === "final_video");
  const assemblyLogAsset = assets.find((a) => a.assetType === "assembly_log");
  const hasVoiceAsset = assets.some((a) => a.assetType === "voice_audio");

  return (
    <div className="space-y-6">
      {/* Content Selector & Export Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div className="space-y-1">
          <label
            htmlFor="flowContentSelect"
            className="block text-xs font-semibold uppercase tracking-wider text-stone-500"
          >
            Pilih Konten untuk Prompt Pack & Unggah Klip Google Flow
          </label>
          <select
            id="flowContentSelect"
            value={selectedContentId}
            onChange={(e) => handleSelectContent(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-900 sm:w-96 sm:text-sm"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.contentCode} — {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            disabled={generatingPrompts || !selectedContentId}
            onClick={handleGeneratePrompts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {generatingPrompts
                ? "Menyusun Prompt..."
                : "Generate / Refresh Prompt Pack"}
            </span>
          </button>

          <a
            href={`/api/scenes/export?contentId=${encodeURIComponent(
              selectedContentId
            )}&format=txt`}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-semibold text-stone-800 hover:bg-stone-100"
          >
            <FileText className="h-3.5 w-3.5 text-amber-600" />
            <span>Unduh TXT</span>
          </a>

          <a
            href={`/api/scenes/export?contentId=${encodeURIComponent(
              selectedContentId
            )}&format=csv`}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-semibold text-stone-800 hover:bg-stone-100"
          >
            <Download className="h-3.5 w-3.5 text-sky-600" />
            <span>Unduh CSV</span>
          </a>

          <a
            href={`/api/scenes/export?contentId=${encodeURIComponent(
              selectedContentId
            )}&format=xlsx`}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-semibold text-stone-800 hover:bg-stone-100"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Unduh XLSX</span>
          </a>
        </div>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : feedback.type === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {/* Semi-Manual Flow Upload & Completeness Status */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          title="Unggah Multi-Klip Hasil Google Flow (Semi-Manual Mode)"
          description="Unggah beberapa file MP4 sekaligus. Sistem mencocokkan nama file (mis. CO-2026-001_SCENE_001.mp4 atau scene_1.mp4) ke nomor scene secara otomatis."
          badge={<StatusBadge label="Semi-Manual Flow" variant="info" />}
        >
          <form onSubmit={handleUploadClips} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-stone-700">
                Pilih Satu atau Beberapa File Video Klip (.mp4)
              </label>
              <input
                type="file"
                multiple
                accept="video/*,.mp4"
                onChange={(e) =>
                  setSelectedFiles(Array.from(e.target.files ?? []))
                }
                className="mt-1 block w-full text-xs text-stone-700 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-amber-900"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <label className="block font-medium text-stone-700">
                  Pemetaan Scene (Opsional)
                </label>
                <select
                  value={manualSceneId}
                  onChange={(e) => setManualSceneId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-stone-900"
                >
                  <option value="">
                    Otomatis dari Nama File (Direkomendasikan)
                  </option>
                  {scenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      Scene #{sc.sceneIndex} ({sc.expectedFilename})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-stone-700">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>Ganti klip lama pada scene yang sama</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={selectedFiles.length === 0 || uploadingClips}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>
                  {uploadingClips
                    ? "Mengunggah & Memetakan..."
                    : `Unggah ${selectedFiles.length || ""} Klip Scene`}
                </span>
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Checklist Kelengkapan Klip Scene"
          description="Perakitan FFmpeg (Milestone 5) hanya dapat dijalankan jika seluruh scene sudah memiliki klip tanpa duplikasi."
          badge={
            <StatusBadge
              label={
                completeness.readyForAssembly
                  ? "Siap Dirakit (Lengkap)"
                  : `${completeness.uploadedSceneCount}/${completeness.totalScenes} Scene Terisi`
              }
              variant={completeness.readyForAssembly ? "success" : "warning"}
            />
          }
        >
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                label={`Terunggah: ${completeness.uploadedSceneCount}/${completeness.totalScenes}`}
                variant={
                  completeness.readyForAssembly ? "success" : "info"
                }
              />
              <StatusBadge
                label={`Kurang (Missing): ${completeness.missingSceneIndices.length}`}
                variant={
                  completeness.missingSceneIndices.length > 0
                    ? "warning"
                    : "neutral"
                }
              />
              <StatusBadge
                label={`Duplikat: ${completeness.duplicateSceneIndices.length}`}
                variant={
                  completeness.duplicateSceneIndices.length > 0
                    ? "danger"
                    : "neutral"
                }
              />
            </div>

            {completeness.missingExpectedFilenames.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-amber-950">
                <p className="font-semibold">
                  File Scene yang Masih Kurang (Missing):
                </p>
                <p className="mt-1 font-mono text-[11px]">
                  {completeness.missingExpectedFilenames.join(", ")}
                </p>
              </div>
            ) : null}

            {completeness.duplicateSceneIndices.length > 0 ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-950">
                <p className="font-semibold">
                  ⚠️ Terdeteksi Klip Ganda pada Scene: #
                  {completeness.duplicateSceneIndices.join(", #")}
                </p>
              </div>
            ) : null}

            {completeness.unmappedFilenames.length > 0 ? (
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-stone-700">
                <p className="font-semibold">
                  File Belum Terpetakan ke Nomor Scene:
                </p>
                <p className="mt-1 font-mono text-[11px]">
                  {completeness.unmappedFilenames.join(", ")}
                </p>
              </div>
            ) : null}

            {/* FFmpeg Master Assembly Controls */}
            <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-900">
                    Perakitan Video Master 9:16 (FFmpeg H.264 + AAC)
                  </p>
                  <p className="text-[11px] text-stone-600">
                    Menyatukan seluruh klip berurutan + audio narasi (1080x1920, tanpa subtitle, tanpa watermark).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      assemblingVideo ||
                      !completeness.readyForAssembly ||
                      !hasVoiceAsset
                    }
                    onClick={handleRunAssembly}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Film className="h-4 w-4" />
                    <span>
                      {assemblingVideo
                        ? "Merakit Video 9:16..."
                        : "Rakit Video Master 9:16"}
                    </span>
                  </button>

                  {finalVideoAsset ? (
                    <a
                      href={`/api/assembly?contentId=${encodeURIComponent(
                        selectedContentId
                      )}&download=1`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Unduh {finalVideoAsset.originalFilename}</span>
                    </a>
                  ) : null}
                </div>
              </div>

              {!hasVoiceAsset ? (
                <p className="text-[11px] text-amber-800">
                  ⚠️ Aset suara narasi (`voice_audio`) belum dibuat. Buat suara terlebih dahulu di menu <strong>Production</strong> sebelum merakit video.
                </p>
              ) : null}

              {finalVideoAsset ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px] text-emerald-950">
                  <p className="font-semibold">
                    ✅ Video Master Tersedia: {finalVideoAsset.originalFilename}{" "}
                    ({finalVideoAsset.width}x{finalVideoAsset.height} •{" "}
                    {((finalVideoAsset.durationMs ?? 0) / 1000).toFixed(1)}s)
                  </p>
                </div>
              ) : null}

              {assemblyLogText ||
              typeof assemblyLogAsset?.metadata?.logText === "string" ? (
                <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-900 p-2.5 font-mono text-[10px] text-stone-100">
                  {assemblyLogText ||
                    String(assemblyLogAsset?.metadata?.logText ?? "")}
                </pre>
              ) : null}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Scene Cards with Prompts & Copy Buttons */}
      <SectionCard
        title={`Paket Prompt Origami per Scene (${
          selectedContent?.contentCode ?? "-"
        })`}
        description="Salin prompt ke Google Flow, simpan hasil videonya sesuai nama file target, lalu unggah kembali di atas."
        badge={
          <StatusBadge label="No Subtitles • 9:16 Origami" variant="success" />
        }
      >
        {scenes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
            <Film className="mx-auto h-6 w-6 text-stone-400 mb-2" />
            <p>
              Klik tombol <strong>Generate / Refresh Prompt Pack</strong> di atas untuk membuat segmen dan paket prompt origami secara otomatis.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenes.map((sc) => {
              const matchingClips = sceneClipAssets.filter(
                (a) =>
                  a.sceneId === sc.id || sc.uploadedClipAssetId === a.id
              );
              const hasClip = matchingClips.length > 0;

              return (
                <div
                  key={sc.id}
                  className={`rounded-xl border p-4 ${
                    hasClip
                      ? "border-emerald-300 bg-emerald-50/20"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Scene #{sc.sceneIndex}
                      </span>
                      <code className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-xs font-semibold text-stone-800">
                        {sc.expectedFilename}
                      </code>
                      <span className="text-xs text-stone-500">
                        {(sc.startMs / 1000).toFixed(1)}s –{" "}
                        {(sc.endMs / 1000).toFixed(1)}s [
                        {sc.timestampStatus.toUpperCase()}]
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={
                          hasClip
                            ? `Klip Terunggah (${matchingClips.length})`
                            : "Menunggu Klip Flow"
                        }
                        variant={hasClip ? "success" : "warning"}
                      />
                      {sc.promptText ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(sc.promptText);
                            setFeedback({
                              type: "success",
                              text: `Prompt untuk ${sc.expectedFilename} disalin ke clipboard!`,
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                        >
                          <Copy className="h-3.5 w-3.5 text-amber-600" />
                          <span>Salin Prompt</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-stone-700">
                    <strong>Narasi:</strong> &ldquo;{sc.narrationText}&rdquo;
                  </p>

                  {sc.promptText ? (
                    <pre className="mt-2.5 whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-900 p-3 font-mono text-[11px] text-stone-100 leading-relaxed">
                      {sc.promptText}
                    </pre>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      Prompt belum dibuat. Klik tombol Generate Prompt Pack di atas.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
