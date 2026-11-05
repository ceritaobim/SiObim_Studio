"use client";

import { useState, useEffect, type FormEvent, useRef } from "react";
import Link from "next/link";
import {
  Film,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  RefreshCw,
  FileAudio,
  Layers,
  ExternalLink,
  FolderUp,
  Play,
  FileVideo,
  Sparkles,
  Mic,
  ArrowRight,
  Volume2,
  Bot,
  FolderDown,
} from "lucide-react";
import type {
  AssetRecord,
  ContentItemRecord,
  SceneRecord,
} from "@/types/domain";
import { deriveContextualSfxCue } from "@/features/scenes/prompt-generator";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlowCreditVisualizer } from "@/components/providers/flow-credit-visualizer";
import { useStudioMode } from "@/context/studio-mode-context";

interface VideoTableManagerProps {
  initialItems: ContentItemRecord[];
  initialScenesByContent: Record<string, SceneRecord[]>;
  initialAssets: AssetRecord[];
}

/**
 * Builds the exact transcript and copy-ready prompts per user requirement:
 * 1) Transcript formatted by parts: Bagian 1 [0-9] : ...
 * 2) Prompt Project: Base prompt with visual & character rules + explicit output naming + all parts + diakhiri "INSTRUKSI EKSEKUSI: Kerjakan semua bagian..."
 * 3) Prompt Per Bagian: 100% same prompt as Project, bedanya diakhiri: "INSTRUKSI EKSEKUSI: Kerjakan bagian X saja..."
 */
function buildTranscriptAndPromptsFromScenes(
  item: ContentItemRecord,
  scenes: SceneRecord[]
): {
  transcriptFormattedText: string;
  projectPrompt: string;
  getPartPrompt: (sc: SceneRecord) => string;
} {
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);

  const transcriptLines = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    return `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] : ${sc.narrationText}`;
  });

  const detailedPartBlocks = sorted.map((sc) => {
    const startSec = Math.round(sc.startMs / 1000);
    const endSec = Math.round(sc.endMs / 1000);
    const rawDur = Math.max(1, endSec - startSec || Math.round(sc.durationMs / 1000));
    const durationSec = rawDur >= 9 ? 10 : 8;
    const paddedIdx = String(sc.sceneIndex).padStart(3, "0");
    const expectedFilename =
      sc.expectedFilename ||
      `${item.contentCode.toUpperCase()}_SCENE_${paddedIdx}.mp4`;
    const sfxCue =
      sc.sfxCue ||
      deriveContextualSfxCue(
        sc.narrationText,
        sc.visualAction,
        sc.sceneIndex,
        sorted.length
      );

    return [
      `Bagian ${sc.sceneIndex} [${startSec}-${endSec}] (${durationSec}s • Nama Output: Bagian ${sc.sceneIndex} • Target File: ${expectedFilename}) : ${sc.narrationText}`,
      `  - Visual Origami Action: ${sc.visualAction}. (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO text/subtitles).`,
      `  - Efek Suara (Diegetic SFX Cue): ${sfxCue}`,
      `  - Aturan Transisi Audio Mulus: Efek suara berdurasi singkat (1-2 detik) di tengah adegan dan WAJIB memudar senyap (fade to silence) sebelum detik ke-${durationSec}. DILARANG ada musik latar (NO BGM), suara vokal/bicara, atau dengung terus-menerus agar sambungan video berikutnya mulus tanpa audio terpotong.`,
    ].join("\n");
  });

  const fallbackBasePrompt = [
    `=== PROJECT VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
    `Content Code : ${item.contentCode}`,
    `Judul Konten : ${item.title}`,
    `Topik        : ${item.topic}`,
    `Format Video : Vertical 9:16 (1080x1920) • Model: Omni 1.1 Flash (Durasi: 8-10 Detik Saja per Bagian)`,
    ``,
    `[ATURAN PENAMAAN OUTPUT WAJIB]`,
    `- Setiap video yang dihasilkan WAJIB dinamai dan diberi label secara berurutan: "Bagian 1", "Bagian 2", ... hingga "Bagian ${sorted.length}".`,
    `- JANGAN beri nama acak atau deskriptif saja. Cantumkan selalu kata "Bagian [Nomor]" agar urutan file tidak tertukar saat diunduh.`,
    ``,
    `[ATURAN MODEL AI & DURASI WAJIB — OMNI 1.1 FLASH (8-10 DETIK SAJA & 9:16)]`,
    `- Model AI Video: WAJIB HANYA menggunakan Omni 1.1 Flash. DILARANG menggunakan model lain!`,
    `- Format Rasio: WAJIB Vertical 9:16 (1080x1920) layar penuh.`,
    `- Durasi Output: Setiap video WAJIB berdurasi 8-10 detik saja (10 detik atau 8 detik). DILARANG di bawah 8 detik atau di atas 10 detik.`,
    `- Kelanjutan Visual: Jika ucapan narasi selesai lebih awal dari durasi klip, karakter origami tetap bergerak dan berpose natural hingga durasi video selesai.`,
    ``,
    `[ATURAN VISUAL & KARAKTER WAJIB]`,
    `- Gaya Visual: Handmade folded matte origami paper stop-motion world, tactile paper creases, warm miniature studio lighting, 9:16 vertical.`,
    `- Karakter Utama (Obim): Anak laki-laki origami kertas dengan potongan rambut mangkuk kertas hitam, memakai kemeja flanel kotak-kotak merah-hitam lipatan kertas di atas kaos putih kertas, celana pendek denim biru kertas, dan sepatu kets merah kertas.`,
    `- Aturan Ketat: 100% dunia lipatan kertas origami stop-motion. DILARANG menampilkan subtitle, teks di layar, huruf, watermark, atau manusia/objek realistis.`,
    `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian dari Bagian 1 hingga Bagian ${sorted.length}.`,
    ``,
    `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB — ZERO TRANSITION CUT-OFF]`,
    `- DILARANG KERAS ADA BACKGROUND MUSIC (NO CONTINUOUS BGM / NO AMBIENT MUSIC): Tidak boleh ada instrumen musik, beat, drone, melodi, atau ritme latar yang terus-menerus mengisi video klip.`,
    `- DILARANG ADA SUARA BICARA (NO SPEECH / NO DIALOGUE): Karakter origami Obim dan objek lainnya dilarang mengeluarkan suara kata/bicara/vokal (narasi diisi terpisah melalui dubbing suara narator).`,
    `- HANYA EFEK SUARA DIEGETIK PENDEK (ISOLATED FOLEY SFX): Hanya sertakan efek suara nyata kontekstual berdurasi 1-2 detik yang selaras dengan panduan Efek Suara pada setiap bagian (contoh: bunyi gemerisik lipatan kertas origami, denting ide singkat, desau horor pendek "huuu", bunyi detik jam dinding hening, dll).`,
    `- ATURAN KEHENINGAN DI AWAL & AKHIR (MANDATORY SILENCE AT HEAD & TAIL): Efek suara harus mulai sedikit setelah awal adegan (+0.3s) dan HARUS selesai serta memudar sempurna menjadi hening (complete fade-out to silence) minimal 0.5 detik sebelum durasi klip berakhir.`,
    `- TUJUAN TRANSISI SINKRON: Dengan aturan jeda senyap ini, saat seluruh bagian video digabungkan secara berurutan, TIDAK AKAN ADA suara latar yang terpotong secara kasar/patah di antara pergantian scene. Konten tetap interaktif dengan aksen suara yang hidup tanpa merusak transisi.`,
    ``,
    `[DAFTAR TRANSKRIP & BAGIAN SCENE (MAKSIMAL 10 DETIK PER BAGIAN)]`,
    ...detailedPartBlocks,
  ].join("\n");

  const firstSavedPrompt = sorted[0]?.promptText?.trim() || "";
  const hasUnifiedSavedPrompt =
    firstSavedPrompt.includes("INSTRUKSI EKSEKUSI:") &&
    firstSavedPrompt.includes("Bagian 1 [");

  const basePrompt = hasUnifiedSavedPrompt
    ? firstSavedPrompt.replace(
        /\n*INSTRUKSI EKSEKUSI:\s*Kerjakan[^\n]*$/i,
        ""
      )
    : fallbackBasePrompt;

  const projectPrompt = `${basePrompt}\n\nINSTRUKSI EKSEKUSI: Kerjakan semua bagian secara berurutan HANYA menggunakan model Omni 1.1 Flash (durasi 8-10 detik saja, 9:16 vertikal) dan namai setiap output dengan "Bagian 1", "Bagian 2", dst.`;

  const getPartPrompt = (sc: SceneRecord) => {
    const saved = sc.promptText?.trim() || "";
    if (
      saved.includes("INSTRUKSI EKSEKUSI:") &&
      saved.includes("Bagian 1 [")
    ) {
      return saved;
    }
    return `${basePrompt}\n\nINSTRUKSI EKSEKUSI: Kerjakan bagian ${sc.sceneIndex} saja HANYA menggunakan model Omni 1.1 Flash (durasi 8-10 detik saja, 9:16 vertikal) dan namai output dengan "Bagian ${sc.sceneIndex}".`;
  };

  return {
    transcriptFormattedText: transcriptLines.join("\n\n"),
    projectPrompt,
    getPartPrompt,
  };
}

export function VideoTableManager({
  initialItems,
  initialScenesByContent,
  initialAssets,
}: VideoTableManagerProps) {
  const { isAdvance } = useStudioMode();
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [scenesByContent, setScenesByContent] = useState<
    Record<string, SceneRecord[]>
  >(initialScenesByContent);
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets);

  useEffect(() => {
    setAssets(initialAssets);
  }, [initialAssets]);

  useEffect(() => {
    setScenesByContent(initialScenesByContent);
  }, [initialScenesByContent]);

  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(() => {
    for (let idx = 0; idx < initialItems.length; idx++) {
      const it = initialItems[idx]!;
      const hasVoice = initialAssets.some(
        (a) => a.contentId === it.id && a.assetType === "voice_audio"
      );
      if (hasVoice) {
        const match = it.contentCode.match(/(\d+)$/);
        const num = match?.[1] ? parseInt(match[1], 10) : idx + 1;
        return Math.max(1, Math.ceil(num / 7));
      }
    }
    return 1;
  });

  const [expandedContentId, setExpandedContentId] = useState<string | null>(
    () => {
      for (const it of initialItems) {
        const hasVoice = initialAssets.some(
          (a) => a.contentId === it.id && a.assetType === "voice_audio"
        );
        if (hasVoice) return it.id;
      }
      return initialItems[0]?.id ?? null;
    }
  );

  const [triggeringContentId, setTriggeringContentId] = useState<string | null>(
    null
  );
  const [uploadingContentId, setUploadingContentId] = useState<string | null>(
    null
  );
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(
    null
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetSceneId, setTargetSceneId] = useState<string>("");
  const [syncingAllDrive, setSyncingAllDrive] = useState(false);
  const [syncingMacroDrop, setSyncingMacroDrop] = useState(false);

  const handleSyncMacroDrop = async () => {
    setSyncingMacroDrop(true);
    try {
      const res = await fetch("/api/macro/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyinkronkan dropzone makro.");
      }

      const scenesRes = await fetch("/api/scenes?all=true", {
        cache: "no-store",
      });
      if (scenesRes.ok) {
        const sData = await scenesRes.json();
        if (Array.isArray(sData.assets)) setAssets(sData.assets);
        if (sData.scenesByContent) setScenesByContent(sData.scenesByContent);
      }

      if (data.scannedCount === 0) {
        setFeedback({
          type: "warning",
          text: "Folder storage/macro_drops kosong. Belum ada klip video baru yang disimpan oleh makro.",
        });
      } else {
        const assembledMsg =
          data.assembledVideos?.length > 0
            ? ` 🎉 ${data.assembledVideos.length} video final 00Final.mp4 berhasil dirakit & disinkronkan ke Google Drive!`
            : "";
        setFeedback({
          type: "success",
          text: `✅ ${data.ingestedCount} klip video baru berhasil diserap & dipetakan otomatis ke adegan!${assembledMsg}`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Error saat sync dropzone makro.",
      });
    } finally {
      setSyncingMacroDrop(false);
    }
  };

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const getClipForScene = (contentId: string, scene: SceneRecord) => {
    return assets.find(
      (a) =>
        a.contentId === contentId &&
        a.assetType === "scene_video" &&
        (a.sceneId === scene.id ||
          a.id === scene.uploadedClipAssetId ||
          a.originalFilename === `Bagian ${scene.sceneIndex}.mp4` ||
          (a.metadata as Record<string, unknown> | undefined)?.partIndex ===
            scene.sceneIndex ||
          a.originalFilename.includes(`_Bagian_0${scene.sceneIndex}`) ||
          a.originalFilename.includes(`SCENE_00${scene.sceneIndex}`))
    );
  };

  const [programFilter, setProgramFilter] = useState<string>("all");

  const getWeekAndDay = (item: ContentItemRecord, idx: number) => {
    const match = item.contentCode.match(/(\d+)$/);
    const num = match?.[1] ? parseInt(match[1], 10) : idx + 1;
    const itemsPerWeek = 21;
    const weekNum = Math.max(1, Math.ceil(num / itemsPerWeek));
    const dayNum = Math.floor(((num - 1) % itemsPerWeek) / 3) + 1;
    const programSlot = ((num - 1) % 3) + 1;
    return { weekNum, dayNum, programSlot };
  };

  const itemsWithWeek = items.map((item, idx) => ({
    item,
    ...getWeekAndDay(item, idx),
  }));

  const maxWeek = Math.max(1, ...itemsWithWeek.map((entry) => entry.weekNum));
  const weekOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);

  const filteredWeekItems = itemsWithWeek.filter((entry) => {
    if (entry.weekNum !== selectedWeekNum) return false;
    if (programFilter !== "all" && entry.item.programName !== programFilter) {
      return false;
    }
    return true;
  });

  let totalClipsNeeded = 0;
  let totalClipsDone = 0;
  let activeTargetItem: ContentItemRecord | null = null;
  let activeTargetDone = 0;
  let activeTargetTotal = 0;

  for (const { item } of filteredWeekItems) {
    const scList = scenesByContent[item.id] ?? [];
    const doneCount = scList.filter((sc) =>
      Boolean(getClipForScene(item.id, sc))
    ).length;
    totalClipsNeeded += scList.length;
    totalClipsDone += doneCount;

    if (!activeTargetItem && doneCount < scList.length) {
      activeTargetItem = item;
      activeTargetDone = doneCount;
      activeTargetTotal = scList.length;
    }
  }

  // Trigger audio re-transcription (<=10s per Bagian) + copy Prompt Project
  const handleTriggerContentPrompts = async (
    item: ContentItemRecord,
    retranscribeAudio = true
  ) => {
    setTriggeringContentId(item.id);
    setFeedback(null);

    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: item.id,
          retranscribeAudio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || "Gagal mentranskrip audio & menyusun prompt bagian."
        );
      }

      const updatedScenes: SceneRecord[] = data.scenes ?? [];
      setScenesByContent((prev) => ({
        ...prev,
        [item.id]: updatedScenes,
      }));
      setExpandedContentId(item.id);

      const built = buildTranscriptAndPromptsFromScenes(item, updatedScenes);
      await navigator.clipboard.writeText(built.projectPrompt);

      setFeedback({
        type: "success",
        text: `Berhasil! Audio ${item.contentCode} ditranskrip ulang menjadi ${updatedScenes.length} Bagian (8–10 detik/bagian). Prompt Project (Kerjakan semua bagian) OTOMATIS TERSALIN ke clipboard! Siap dipaste ke Google Flow.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan transkrip audio & prompt generator.",
      });
    } finally {
      setTriggeringContentId(null);
    }
  };

  const [assemblingContentId, setAssemblingContentId] = useState<string | null>(
    null
  );

  const getFinalVideoForContent = (contentId: string) => {
    return assets.find(
      (a) => a.contentId === contentId && a.assetType === "final_video"
    );
  };

  const handleUploadFileList = async (
    contentId: string,
    filesToUpload: File[],
    sceneIdOverride?: string
  ) => {
    if (filesToUpload.length === 0) return;
    setUploadingContentId(contentId);
    setUploadingSceneId(sceneIdOverride ?? null);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append("contentId", contentId);
      if (sceneIdOverride) {
        formData.append("sceneId", sceneIdOverride);
      }
      formData.append("replaceExisting", "true");
      for (const f of filesToUpload) {
        formData.append("files", f);
      }

      const res = await fetch("/api/scenes", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengunggah klip video.");
      }

      setScenesByContent((prev) => ({
        ...prev,
        [contentId]: data.scenes ?? prev[contentId] ?? [],
      }));
      if (Array.isArray(data.assets)) {
        setAssets((prev) => [
          ...data.assets,
          ...prev.filter((a) => a.contentId !== contentId),
        ]);
      }
      setSelectedFiles([]);
      setTargetSceneId("");

      if (data.autoAssembled && data.finalVideoAsset) {
        setFeedback({
          type: "success",
          text: `🎉 Luar biasa! ${data.matchSummary?.length ?? filesToUpload.length} klip bagian berhasil disimpan, OTOMATIS DI-RENAME sesuai nama bagian ("Bagian 1.mp4", dst.), terupload ke Google Drive, dan OTOMATIS dirakit menjadi "00Final.mp4" yang sudah tersinkron ke Google Drive!`,
        });
      } else {
        const uploadedCount = data.completeness?.uploadedSceneCount ?? 0;
        const totalCount = data.completeness?.totalScenes ?? 0;
        setFeedback({
          type: "success",
          text: `✓ ${data.matchSummary?.length ?? filesToUpload.length} klip video berhasil disimpan, OTOMATIS DI-RENAME menjadi Bagian (contoh: "Bagian 1.mp4") & diunggah ke Google Drive! (${uploadedCount}/${totalCount} bagian terisi).`,
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal mengunggah klip video.",
      });
    } finally {
      setUploadingContentId(null);
      setUploadingSceneId(null);
    }
  };

  const handleRunAssembly = async (contentId: string) => {
    setAssemblingContentId(contentId);
    setFeedback(null);
    try {
      const res = await fetch("/api/assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menggabungkan klip menjadi 00Final.");
      }
      if (data.finalVideoAsset) {
        setAssets((prev) => [
          data.finalVideoAsset,
          ...prev.filter(
            (a) => !(a.contentId === contentId && a.assetType === "final_video")
          ),
        ]);
      }
      setFeedback({
        type: "success",
        text: `✓ Berhasil! Seluruh klip bagian telah digabungkan berurutan menjadi "00Final.mp4" dan terupload otomatis ke Google Drive!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal merakit 00Final.",
      });
    } finally {
      setAssemblingContentId(null);
    }
  };

  const handleDownloadContent = async (contentId: string) => {
    const existingFinal = assets.find(
      (a) => a.contentId === contentId && a.assetType === "final_video"
    );
    if (!existingFinal) {
      try {
        await handleRunAssembly(contentId);
      } catch {
        return;
      }
    }
    window.location.href = `/api/assembly?contentId=${encodeURIComponent(
      contentId
    )}&download=1`;
  };

  const itemsWithVideosInWeek = filteredWeekItems.filter(({ item }) => {
    return assets.some(
      (a) =>
        a.contentId === item.id &&
        (a.assetType === "scene_video" || a.assetType === "final_video")
    );
  });

  const handleSyncAllVideosInWeekToGDrive = async () => {
    if (itemsWithVideosInWeek.length === 0) return;
    setSyncingAllDrive(true);
    setFeedback(null);
    let totalUploaded = 0;
    try {
      for (const { item } of itemsWithVideosInWeek) {
        const res = await fetch("/api/scenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_gdrive",
            contentId: item.id,
          }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.assets)) {
          setAssets((prev) => [
            ...data.assets,
            ...prev.filter(
              (a) =>
                !(
                  a.contentId === item.id &&
                  (a.assetType === "scene_video" || a.assetType === "final_video")
                )
            ),
          ]);
          totalUploaded += data.uploadedCount || 0;
        }
      }
      setFeedback({
        type: "success",
        text: `✓ Berhasil menyinkronkan ${totalUploaded} file video klip bagian & 00Final Week ${selectedWeekNum} langsung ke folder Google Drive masing-masing!`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menyinkronkan video ke Google Drive.",
      });
    } finally {
      setSyncingAllDrive(false);
    }
  };

  const handleUploadClips = async (e: FormEvent, contentId: string) => {
    e.preventDefault();
    await handleUploadFileList(
      contentId,
      selectedFiles,
      targetSceneId || undefined
    );
  };

  return (
    <div className="space-y-5">
      {/* Top Workflow Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Film className="h-4 w-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Alur Kerja Tahap 3–5: Transkrip Audio (8–10s) → Prompt Project & Prompt Per Bagian (Omni 1.1 Flash • 9:16)
            </span>
          </div>
          <h1 className="mt-1 text-base font-bold text-stone-900 sm:text-lg">
            Transkrip Audio (8–10 Detik Saja) & Generator Prompt Video (Google Flow / Omni 1.1 Flash • 9:16)
          </h1>
          <p className="text-xs text-stone-500">
            Audio ditranskrip ulang per bagian (<strong>8–10 detik saja</strong>, rasio <strong>9:16</strong> vertikal dengan model <strong>Omni 1.1 Flash</strong>). Gunakan <strong>Copy Prompt Project</strong> (<em>&ldquo;Kerjakan semua bagian&rdquo;</em>) atau <strong>Copy Prompt Bagian X</strong> (<em>&ldquo;Kerjakan bagian X saja&rdquo;</em>) untuk dipaste ke Google Flow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Week Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
            {weekOptions.map((wk) => (
              <button
                key={wk}
                type="button"
                onClick={() => setSelectedWeekNum(wk)}
                className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                  selectedWeekNum === wk
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                Week {wk}
              </button>
            ))}
          </div>

          {/* Program Filter Pills */}
          <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setProgramFilter("all")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                programFilter === "all"
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "text-stone-600 hover:bg-stone-200"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setProgramFilter("Ke Dapur Yuk!")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                programFilter === "Ke Dapur Yuk!"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "text-amber-800 hover:bg-amber-100"
              }`}
            >
              🍳 Ke Dapur Yuk!
            </button>
            <button
              type="button"
              onClick={() => setProgramFilter("Kepikiran Aja")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                programFilter === "Kepikiran Aja"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-indigo-800 hover:bg-indigo-100"
              }`}
            >
              🌙 Kepikiran Aja
            </button>
            <button
              type="button"
              onClick={() => setProgramFilter("Eh, Ternyata!")}
              className={`rounded-lg px-2.5 py-1.5 font-bold transition-colors ${
                programFilter === "Eh, Ternyata!"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              💡 Eh, Ternyata!
            </button>
          </div>

          {/* GDrive Batch Sync Button */}
          <button
            type="button"
            disabled={syncingAllDrive || itemsWithVideosInWeek.length === 0}
            onClick={handleSyncAllVideosInWeekToGDrive}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 font-bold text-sky-800 shadow-2xs hover:bg-sky-100 disabled:opacity-50 transition-colors"
            title="Upload semua klip video bagian dan 00Final Week ini langsung ke folder Google Drive"
          >
            <FolderUp
              className={`h-3.5 w-3.5 text-sky-600 ${
                syncingAllDrive ? "animate-bounce" : ""
              }`}
            />
            <span>
              {syncingAllDrive
                ? "Menyinkronkan..."
                : `⚡ Sinkronkan Video Week ${selectedWeekNum} ke GDrive`}
            </span>
          </button>

          <a
            href="https://flow.google.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 font-bold text-stone-800 hover:bg-stone-200"
          >
            <span>Buka Google Flow</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          {activeTargetItem ? (
            <button
              type="button"
              disabled={Boolean(triggeringContentId)}
              onClick={() => handleTriggerContentPrompts(activeTargetItem!, true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              <span>
                📋 Copy Prompt Project {activeTargetItem.contentCode} (Semua Bagian)
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Google Flow 10-Profile Credit Visualizer */}
      <FlowCreditVisualizer />

      {/* Makro Auto-Pilot & Dropzone Hub */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Dropzone Klip Otomatis
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                {totalClipsDone}/{totalClipsNeeded} Bagian Selesai
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Klip baru yang disimpan otomatis dipetakan ke adegan &amp; dirakit menjadi video final.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={syncingMacroDrop}
            onClick={handleSyncMacroDrop}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncingMacroDrop ? "animate-spin" : ""}`}
            />
            <span>
              {syncingMacroDrop ? "Menyinkronkan..." : "Sinkronkan Dropzone Makro"}
            </span>
          </button>

          {isAdvance && (
            <a
              href="/api/macro/queue"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-800 shadow-2xs hover:bg-indigo-50 transition-colors"
              title="Lihat atau unduh antrean JSON task makro"
            >
              <FolderDown className="h-3.5 w-3.5 text-indigo-600" />
              <span>Antrean JSON</span>
            </a>
          )}
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

      {/* Main Content Table */}
      <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-3 px-4">Jadwal / Kode</th>
                <th className="py-3 px-4">Judul Konten</th>
                <th className="py-3 px-4">Status Audio & Bagian (≤10s)</th>
                <th className="py-3 px-4">Target Scene Berikutnya</th>
                <th className="py-3 px-4 text-right">Aksi Transkrip & Prompt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredWeekItems.map(({ item }) => {
                const scList = scenesByContent[item.id] ?? [];
                const doneCount = scList.filter((sc) =>
                  Boolean(getClipForScene(item.id, sc))
                ).length;
                const nextUnfinishedScene = scList.find(
                  (sc) => !getClipForScene(item.id, sc)
                );
                const voiceAsset = assets.find(
                  (a) =>
                    a.contentId === item.id && a.assetType === "voice_audio"
                );
                const fixedAudioSeconds = voiceAsset?.durationMs
                  ? Math.round(voiceAsset.durationMs / 1000)
                  : null;
                const isExpanded = expandedContentId === item.id;
                const isTriggering = triggeringContentId === item.id;

                return (
                  <VideoContentRow
                    key={item.id}
                    item={item}
                    hasVoiceAudio={Boolean(voiceAsset)}
                    fixedAudioSeconds={fixedAudioSeconds}
                    scenes={scList}
                    doneCount={doneCount}
                    nextUnfinishedScene={nextUnfinishedScene}
                    isExpanded={isExpanded}
                    isTriggering={isTriggering}
                    uploadingContentId={uploadingContentId}
                    uploadingSceneId={uploadingSceneId}
                    selectedFiles={selectedFiles}
                    targetSceneId={targetSceneId}
                    finalVideoAsset={getFinalVideoForContent(item.id)}
                    isAssembling={assemblingContentId === item.id}
                    getClipForScene={getClipForScene}
                    onToggleExpand={() =>
                      setExpandedContentId(isExpanded ? null : item.id)
                    }
                    onTrigger={() => handleTriggerContentPrompts(item, true)}
                    onRunAssembly={() => handleRunAssembly(item.id)}
                    onDownloadContent={() => handleDownloadContent(item.id)}
                    onUploadFileList={(files, sceneId) =>
                      handleUploadFileList(item.id, files, sceneId)
                    }
                    onSelectFiles={setSelectedFiles}
                    onSelectTargetScene={setTargetSceneId}
                    onUploadClips={(e) => handleUploadClips(e, item.id)}
                    onCopyPrompt={(prompt, label) => {
                      navigator.clipboard.writeText(prompt);
                      setFeedback({
                        type: "success",
                        text: `${label} berhasil disalin ke clipboard! Siap dipaste ke Google Flow.`,
                      });
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function VideoContentRow({
  item,
  hasVoiceAudio,
  fixedAudioSeconds,
  scenes,
  doneCount,
  nextUnfinishedScene,
  isExpanded,
  isTriggering,
  uploadingContentId,
  uploadingSceneId,
  selectedFiles,
  targetSceneId,
  finalVideoAsset,
  isAssembling,
  getClipForScene,
  onToggleExpand,
  onTrigger,
  onRunAssembly,
  onDownloadContent,
  onUploadFileList,
  onSelectFiles,
  onSelectTargetScene,
  onUploadClips,
  onCopyPrompt,
}: {
  item: ContentItemRecord;
  hasVoiceAudio: boolean;
  fixedAudioSeconds: number | null;
  scenes: SceneRecord[];
  doneCount: number;
  nextUnfinishedScene: SceneRecord | undefined;
  isExpanded: boolean;
  isTriggering: boolean;
  uploadingContentId: string | null;
  uploadingSceneId: string | null;
  selectedFiles: File[];
  targetSceneId: string;
  finalVideoAsset?: AssetRecord;
  isAssembling: boolean;
  getClipForScene: (
    contentId: string,
    scene: SceneRecord
  ) => AssetRecord | undefined;
  onToggleExpand: () => void;
  onTrigger: () => void;
  onRunAssembly: () => void;
  onDownloadContent: () => void;
  onUploadFileList: (files: File[], sceneIdOverride?: string) => Promise<void>;
  onSelectFiles: (files: File[]) => void;
  onSelectTargetScene: (id: string) => void;
  onUploadClips: (e: FormEvent) => void;
  onCopyPrompt: (prompt: string, label: string) => void;
}) {
  const allDone = scenes.length > 0 && doneCount === scenes.length;
  const built = buildTranscriptAndPromptsFromScenes(item, scenes);
  const { isAdvance } = useStudioMode();

  return (
    <>
      <tr
        onClick={onToggleExpand}
        className="cursor-pointer hover:bg-stone-50/90 transition-colors"
      >
        <td className="py-3 px-4 whitespace-nowrap">
          <span className="font-mono font-bold text-stone-900">
            {item.contentCode}
          </span>
          <span className="block text-[11px] text-stone-500">
            {item.publishedAt || "Jadwal Mingguan"}
          </span>
        </td>
        <td className="py-3 px-4 font-bold text-stone-900 max-w-xs">
          <span className="line-clamp-2">{item.title}</span>
          {item.programName && (
            <span
              className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                item.programName === "Ke Dapur Yuk!"
                  ? "border-amber-300 bg-amber-100 text-amber-900"
                  : item.programName === "Kepikiran Aja"
                  ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                  : "border-emerald-300 bg-emerald-100 text-emerald-900"
              }`}
            >
              {item.programName === "Ke Dapur Yuk!"
                ? "🍳 "
                : item.programName === "Kepikiran Aja"
                ? "🌙 "
                : "💡 "}
              {item.programName}
            </span>
          )}
        </td>
        <td className="py-3 px-4 whitespace-nowrap">
          <StatusBadge
            label={
              !hasVoiceAudio
                ? "Menunggu Audio (0 Bagian)"
                : fixedAudioSeconds
                ? `${scenes.length} Bagian (Audio ${fixedAudioSeconds}s Fix • ${doneCount}/${scenes.length} Klip)`
                : `${scenes.length} Bagian (${doneCount}/${scenes.length} Klip)`
            }
            variant={
              !hasVoiceAudio ? "warning" : allDone ? "success" : "info"
            }
          />
          {!hasVoiceAudio ? (
            <span className="mt-0.5 block text-[10px] text-amber-700">
              Belum ada file audio (Generate di menu Voice Over)
            </span>
          ) : (
            <span className="mt-0.5 block text-[10px] text-emerald-700 font-medium">
              ✓ Audio tersedia — Transkrip ≤10s siap
            </span>
          )}
        </td>
        <td className="py-3 px-4 whitespace-nowrap text-stone-700">
          {!hasVoiceAudio ? (
            <span className="text-xs text-stone-400 italic">
              Belum ada bagian
            </span>
          ) : nextUnfinishedScene ? (
            <span className="font-mono font-semibold text-stone-800">
              Bagian {nextUnfinishedScene.sceneIndex} [
              {Math.round(nextUnfinishedScene.startMs / 1000)}-
              {Math.round(nextUnfinishedScene.endMs / 1000)}]
            </span>
          ) : (
            <span className="font-semibold text-emerald-700">
              ✅ Lengkap ({scenes.length}/{scenes.length})
            </span>
          )}
        </td>
        <td
          className="py-3 px-4 text-right whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inline-flex items-center gap-1.5">
            {!hasVoiceAudio && scenes.length === 0 ? (
              <Link
                href="/production"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-white hover:bg-amber-600 transition-colors shadow-2xs"
                title="Buka menu Voice Over untuk generate audio terlebih dahulu"
              >
                <Mic className="h-3.5 w-3.5" />
                <span>🎙️ Generate Audio Dulu</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled={isTriggering}
                onClick={onTrigger}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                title="Copy Prompt Project (Keseluruhan) ke Clipboard"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{isTriggering ? "Menyusun..." : "📋 Copy Prompt Project"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:bg-stone-100"
            >
              <span>
                {isExpanded
                  ? "Tutup"
                  : `Buka ${scenes.length} Bagian`}
              </span>
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </td>
      </tr>

      {isExpanded ? (
        <tr className="bg-stone-50/80">
          <td colSpan={5} className="p-4 space-y-4">
            {scenes.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-center space-y-3 shadow-2xs">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Mic className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 sm:text-base">
                    Transkrip &amp; Pemecahan Bagian Belum Tersedia
                  </h4>
                  <p className="mt-1.5 max-w-lg mx-auto text-xs text-amber-800 leading-relaxed">
                    Sesuai alur produksi CeritaObim Studio, transkrip dan pemotongan durasi per bagian (&le;10 detik) untuk Google Flow dihasilkan secara otomatis langsung dari narasi atau file audio voice over asli (MP3/WAV).
                  </p>
                  <p className="mt-1 text-xs font-semibold text-amber-900">
                    Silakan generate audio di menu Voice Over terlebih dahulu agar bagian-bagian klip dapat dihitung dengan durasi yang akurat.
                  </p>
                </div>
                <div className="pt-1">
                  <Link
                    href="/production"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 shadow-xs transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                    <span>Ke Menu Voice Over Sekarang</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {!hasVoiceAudio && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 shrink-0 text-amber-600" />
                      <span>
                        Audio voice over belum digenerate di menu Voice Over. Klip tetap bisa digenerate/diunggah melalui makro dengan estimasi durasi. Perakitan <strong>00Final.mp4</strong> &amp; upload ke Google Drive akan otomatis berjalan segera setelah audio dibuat.
                      </span>
                    </div>
                    <Link
                      href="/production"
                      className="font-bold text-amber-800 underline hover:text-amber-950 shrink-0"
                    >
                      Buat Audio Voice Over &rarr;
                    </Link>
                  </div>
                )}
                {/* COMPACT PROMPT ACTION BAR — ONLY IN ADVANCE MODE */}
                {isAdvance && (
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                          <Layers className="h-3.5 w-3.5 text-emerald-600" />
                          Prompt Project ({scenes.length} Bagian • ≤10s)
                        </span>
                        <span className="text-xs text-stone-500 font-mono">
                          {item.contentCode}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600">
                        Salin <strong>Prompt Project</strong> untuk menghasilkan semua bagian sekaligus di Flow.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onCopyPrompt(
                            built.projectPrompt,
                            `Prompt Project (${item.contentCode} — Kerjakan semua bagian)`
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                      >
                        <Copy className="h-4 w-4" />
                        <span>📋 Copy Prompt Project</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onCopyPrompt(
                            built.transcriptFormattedText,
                            `Transkrip Timestamp ${item.contentCode}`
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                        title="Salin teks transkrip narasi dan timestamp"
                      >
                        <Copy className="h-3.5 w-3.5 text-stone-500" />
                        <span>Transkrip</span>
                      </button>

                      <button
                        type="button"
                        disabled={isTriggering}
                        onClick={onTrigger}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                        title="Transkrip ulang audio narasi menjadi bagian-bagian ≤10 detik"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${isTriggering ? "animate-spin" : ""}`}
                        />
                        <span>Transkrip Ulang</span>
                      </button>

                      <a
                        href={`/api/scenes/export?contentId=${encodeURIComponent(
                          item.id
                        )}&format=txt`}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                        title="Unduh file .txt lengkap"
                      >
                        <Download className="h-3.5 w-3.5 text-stone-600" />
                        <span>.txt</span>
                      </a>
                    </div>
                  </div>
                )}

            {/* MASTER 00FINAL VIDEO STATUS & ACTION BANNER */}
            <FinalVideoAssemblyBanner
              item={item}
              scenes={scenes}
              doneCount={doneCount}
              finalVideoAsset={finalVideoAsset}
              isAssembling={isAssembling}
              onRunAssembly={onRunAssembly}
              onDownloadContent={onDownloadContent}
            />

            {/* TABEL PROMPT PER BAGIAN — RINGKAS, BERSIH, TANPA DINDING TEKS */}
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 bg-stone-100/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-700">
                  Daftar Prompt Per Bagian (Tinggal Klik Tombol Copy)
                </span>
                <span className="text-[11px] text-stone-500 font-medium">
                  {scenes.length} Bagian • Maksimal 10 detik/bagian
                </span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase text-stone-600">
                    <th className="py-2.5 px-4">Bagian & Timestamp</th>
                    <th className="py-2.5 px-4">Durasi (Audio vs Klip)</th>
                    <th className="py-2.5 px-4">Target File</th>
                    <th className="py-2.5 px-4 min-w-[280px]">
                      Drag &amp; Drop Klip MP4 (Per Bagian)
                    </th>
                    <th className="py-2.5 px-4 text-right">Tombol Salin Prompt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {scenes.map((sc) => {
                    const clip = getClipForScene(item.id, sc);
                    const startSec = Math.round(sc.startMs / 1000);
                    const endSec = Math.round(sc.endMs / 1000);
                    const durationSec = Math.max(
                      1,
                      endSec - startSec || Math.round(sc.durationMs / 1000)
                    );
                    const partPrompt = built.getPartPrompt(sc);
                    const sfxCue =
                      sc.sfxCue ||
                      deriveContextualSfxCue(
                        sc.narrationText,
                        sc.visualAction,
                        sc.sceneIndex,
                        scenes.length
                      );

                    return (
                      <tr key={sc.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-stone-900">
                            Bagian {sc.sceneIndex}{" "}
                            <span className="text-stone-500 font-normal">
                              [{startSec}-{endSec}s]
                            </span>
                          </div>
                          <div
                            className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-800 bg-sky-50 border border-sky-200/60 rounded px-1.5 py-0.5 max-w-[210px]"
                            title={`Efek Suara (Diegetic SFX Cue): ${sfxCue}\n\nAturan Transisi Mulus: Durasi SFX 1-2 detik di tengah adegan & wajib memudar hening sebelum klip berakhir. Dilarang ada musik latar (BGM) agar sambungan video berikutnya mulus tanpa suara terpotong.`}
                          >
                            <Volume2 className="h-3 w-3 shrink-0 text-sky-600" />
                            <span className="truncate">{sfxCue}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                                durationSec <= 10
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                              title="Durasi suara narasi pada timestamp bagian ini"
                            >
                              Audio: {durationSec}s
                            </span>

                            {clip && clip.durationMs ? (
                              <div className="flex flex-col gap-0.5 text-[10px]">
                                <span className="font-mono text-stone-600 font-semibold">
                                  Klip Flow: {Math.round(clip.durationMs / 1000)}s
                                </span>
                                {Math.round(clip.durationMs / 1000) !== durationSec ? (
                                  <span
                                    className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 border border-amber-200 max-w-[140px]"
                                    title={`Google Flow merender klip ${Math.round(clip.durationMs / 1000)} detik (standar Omni 1.1 Flash 8-10s). Sistem otomatis memotong tepat ${durationSec}s saat 00Final dirakit agar visual dan narasi sinkron sempurna.`}
                                  >
                                    ✂️ Auto-cut ke {durationSec}s di 00Final
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-emerald-700 font-medium">
                                    ✓ Pas {durationSec}s
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px]">
                          <span className="font-bold text-stone-900 block">
                            Bagian {sc.sceneIndex}.mp4
                          </span>
                          <span className="text-[10px] text-stone-400 font-normal block">
                            ({sc.expectedFilename})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 min-w-[280px]">
                          <RowClipDropZone
                            scene={sc}
                            clip={clip}
                            contentId={item.id}
                            isUploading={
                              uploadingContentId === item.id &&
                              (!uploadingSceneId || uploadingSceneId === sc.id)
                            }
                            onUploadFile={(file, sceneId) =>
                              onUploadFileList([file], sceneId)
                            }
                          />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              onCopyPrompt(
                                partPrompt,
                                `Prompt Bagian ${sc.sceneIndex} [${startSec}-${endSec}]`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-bold text-emerald-900 shadow-2xs hover:bg-emerald-100"
                          >
                            <Copy className="h-3.5 w-3.5 text-emerald-700" />
                            <span>Copy Prompt Bagian {sc.sceneIndex}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RowClipDropZone({
  scene,
  clip,
  contentId,
  isUploading,
  onUploadFile,
}: {
  scene: SceneRecord;
  clip?: AssetRecord;
  contentId: string;
  isUploading: boolean;
  onUploadFile: (file: File, sceneId: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".mp4") || f.type.startsWith("video/")
    );
    if (files.length > 0 && files[0]) {
      onUploadFile(files[0], scene.id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file, scene.id);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const gdriveFileUrl = String(clip?.metadata?.gdriveFileUrl ?? "");

  if (isUploading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
        <span className="font-semibold">
          Mengupload &amp; Rename Bagian {scene.sceneIndex}...
        </span>
      </div>
    );
  }

  if (clip) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col gap-1 rounded-xl border p-2 transition-all text-xs ${
          isDragOver
            ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500/30 scale-[1.01]"
            : "border-emerald-200 bg-emerald-50/40"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-[11px]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="font-mono">
              {clip.originalFilename || `Bagian ${scene.sceneIndex}.mp4`}
            </span>
          </span>

          <div className="flex items-center gap-1.5 text-[10px]">
            {gdriveFileUrl ? (
              <a
                href={gdriveFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-bold text-sky-700 hover:underline"
              >
                <span>GDrive</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
            <a
              href={`/api/scenes/clip-stream?contentId=${encodeURIComponent(
                contentId
              )}&assetId=${encodeURIComponent(clip.id)}&download=1`}
              className="inline-flex items-center gap-0.5 font-bold text-stone-600 hover:text-stone-900 hover:underline"
              title={`Unduh ${clip.originalFilename}`}
            >
              <Download className="h-2.5 w-2.5" />
              <span>Unduh</span>
            </a>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-stone-500 hover:text-stone-900 hover:underline"
              title="Ganti klip ini dengan file baru"
            >
              <span>Ganti</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1 text-[10px]">
          {clip.metadata?.rawUploadedFilename &&
          clip.metadata.rawUploadedFilename !== clip.originalFilename ? (
            <span
              className="text-stone-500 font-sans truncate max-w-[170px]"
              title={String(clip.metadata.rawUploadedFilename)}
            >
              Di-rename dari:{" "}
              <code className="text-stone-700 font-mono">
                {String(clip.metadata.rawUploadedFilename)}
              </code>
            </span>
          ) : (
            <span className="text-emerald-700 font-medium">✓ Siap dirakit</span>
          )}
          <span className="text-[9px] text-stone-400 italic">
            (Bisa drop video baru ke sini)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`group relative flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed px-3 py-2 transition-all ${
        isDragOver
          ? "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-500/30 scale-[1.01]"
          : "border-stone-300 bg-stone-50/80 hover:border-emerald-500 hover:bg-emerald-50/50"
      }`}
      title={`Tarik & lepas (drag & drop) file MP4 untuk Bagian ${scene.sceneIndex} ke sini`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
            isDragOver
              ? "bg-emerald-600 text-white"
              : "bg-stone-200 text-stone-600 group-hover:bg-emerald-600 group-hover:text-white"
          } transition-colors`}
        >
          <FolderUp className="h-4 w-4" />
        </div>

        <div className="text-left">
          <p className="text-[11px] font-bold text-stone-800 group-hover:text-emerald-900 transition-colors">
            {isDragOver
              ? `Lepaskan MP4 Bagian ${scene.sceneIndex} di sini!`
              : `Drop MP4 Bagian ${scene.sceneIndex}`}
          </p>
          <p className="text-[10px] text-stone-400 group-hover:text-emerald-700">
            atau klik untuk pilih file
          </p>
        </div>
      </div>

      <span className="rounded-md border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-stone-500 group-hover:border-emerald-300 group-hover:text-emerald-800">
        Upload
      </span>
    </div>
  );
}

function FinalVideoAssemblyBanner({
  item,
  scenes,
  doneCount,
  finalVideoAsset,
  isAssembling,
  onRunAssembly,
  onDownloadContent,
}: {
  item: ContentItemRecord;
  scenes: SceneRecord[];
  doneCount: number;
  finalVideoAsset?: AssetRecord;
  isAssembling: boolean;
  onRunAssembly: () => void;
  onDownloadContent: () => void;
}) {
  const isComplete = scenes.length > 0 && doneCount === scenes.length;
  const gdriveFileUrl = String(finalVideoAsset?.metadata?.gdriveFileUrl ?? "");
  const gdriveDayFolderUrl = String(
    finalVideoAsset?.metadata?.gdriveDayFolderUrl ?? ""
  );

  return (
    <div
      className={`rounded-2xl border p-4 shadow-xs transition-colors ${
        finalVideoAsset
          ? "border-emerald-300 bg-emerald-50/70"
          : isComplete
          ? "border-emerald-200 bg-emerald-50/40"
          : "border-stone-200 bg-stone-50/60"
      }`}
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                finalVideoAsset
                  ? "bg-emerald-600 text-white"
                  : isComplete
                  ? "bg-emerald-700 text-white"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {finalVideoAsset ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Video Konten 00Final Siap &amp; Tersinkron ke Drive
                </>
              ) : isComplete ? (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Semua Klip Lengkap ({doneCount}/{scenes.length}) — Siap Download Konten
                </>
              ) : (
                <>
                  Progres Klip: {doneCount} / {scenes.length} Bagian
                </>
              )}
            </span>

            <span className="font-mono text-xs font-bold text-stone-800">
              Target File: <code>00Final.mp4</code>
            </span>

            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
              Kualitas Lossless (CRF 17 • Audio Voice Over • Video Muted)
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed">
            {finalVideoAsset
              ? `Video bagian 1 s/d ${scenes.length} telah disatukan berurutan, video dimute tanpa suara bocor, dan dilapiskan audio narasi asli menjadi "00Final.mp4" dengan kualitas maksimal tanpa penurunan (CRF 17). Tersedia di penyimpanan lokal & Google Drive.`
              : isComplete
              ? "Seluruh bagian klip telah terupload. Klik tombol \"Download Konten\" untuk langsung menyatukan seluruh bagian berurutan dengan audio narasi dan menyimpannya ke perangkat Anda."
              : `Masih ada ${scenes.length - doneCount} klip bagian yang belum terunggah. Silakan upload file video 1 per 1 pada tabel di bawah untuk mengaktifkan download konten final.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {finalVideoAsset ? (
            <>
              {gdriveFileUrl || gdriveDayFolderUrl ? (
                <a
                  href={gdriveFileUrl || gdriveDayFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 shadow-2xs hover:bg-sky-100"
                  title="Buka file 00Final di Google Drive"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka di Google Drive</span>
                </a>
              ) : null}

              <a
                href={`/api/assembly?contentId=${encodeURIComponent(
                  item.id
                )}&download=1`}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 ring-2 ring-emerald-500/20"
                title="Download video konten 00Final (seluruh bagian berurutan + audio voice over)"
              >
                <Download className="h-4 w-4" />
                <span>📥 Download Konten (00Final.mp4)</span>
              </a>

              <button
                type="button"
                disabled={isAssembling}
                onClick={onRunAssembly}
                className="inline-flex items-center gap-1 rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                title="Rakit ulang 00Final jika ada klip bagian yang baru diganti"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isAssembling ? "animate-spin" : ""}`}
                />
                <span>Rakit Ulang</span>
              </button>
            </>
          ) : isComplete ? (
            <button
              type="button"
              disabled={isAssembling}
              onClick={onDownloadContent}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 ring-2 ring-emerald-500/20"
              title="Satukan seluruh bagian klip secara berurutan dengan audio narasi dan langsung download"
            >
              {isAssembling ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Sedang Menggabung &amp; Menyiapkan Download...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>📥 Download Konten (Satukan &amp; Download)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl bg-stone-200 px-4 py-2.5 text-xs font-bold text-stone-400 cursor-not-allowed"
              title="Lengkapi upload seluruh bagian klip video 1 per 1 pada tabel di bawah terlebih dahulu"
            >
              <Download className="h-4 w-4" />
              <span>📥 Download Konten ({doneCount}/{scenes.length} Bagian)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

