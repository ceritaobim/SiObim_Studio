"use client";

import { useState, type FormEvent } from "react";
import {
  Mic,
  Upload,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Edit3,
  Save,
  Volume2,
} from "lucide-react";
import type {
  AssetRecord,
  ContentItemRecord,
  ProjectSettingsSummary,
  SceneRecord,
} from "@/types/domain";
import type { SceneValidationReport } from "@/features/scenes/scene-segmenter";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface VoiceSceneManagerProps {
  initialItems: ContentItemRecord[];
  initialSelectedContent: ContentItemRecord | null;
  initialScenes: SceneRecord[];
  initialAssets: AssetRecord[];
  initialValidation: SceneValidationReport | null;
  settings: ProjectSettingsSummary;
  ttsProviderLabel: string;
}

function formatMs(ms: number): string {
  const totalSec = (ms / 1000).toFixed(1);
  return `${totalSec}s`;
}

export function VoiceSceneManager({
  initialItems,
  initialSelectedContent,
  initialScenes,
  initialAssets,
  initialValidation,
  settings,
  ttsProviderLabel,
}: VoiceSceneManagerProps) {
  const [items] = useState<ContentItemRecord[]>(initialItems);
  const [selectedContentId, setSelectedContentId] = useState<string>(
    initialSelectedContent?.id ?? initialItems[0]?.id ?? ""
  );
  const [selectedContent, setSelectedContent] =
    useState<ContentItemRecord | null>(initialSelectedContent);
  const [scenes, setScenes] = useState<SceneRecord[]>(initialScenes);
  const [assets, setAssets] = useState<AssetRecord[]>(initialAssets);
  const [validation, setValidation] = useState<SceneValidationReport | null>(
    initialValidation
  );

  // Synthesis / upload state
  const [synthesizing, setSynthesizing] = useState(false);
  const [uploadingMp3, setUploadingMp3] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [manualDurationSec, setManualDurationSec] = useState<number>(
    initialSelectedContent?.targetDurationSeconds ?? 70
  );
  const [alignmentJsonText, setAlignmentJsonText] = useState("");

  // Scene manual adjustment state
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneDraft, setSceneDraft] = useState<{
    startMs: number;
    endMs: number;
    narrationText: string;
    visualAction: string;
    cameraDirection: string;
  } | null>(null);
  const [savingScene, setSavingScene] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const handleSelectContent = async (contentId: string) => {
    setSelectedContentId(contentId);
    setFeedback(null);
    setEditingSceneId(null);

    try {
      const res = await fetch(
        `/api/voice?contentId=${encodeURIComponent(contentId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) {
        setSelectedContent(data.selectedContent);
        setScenes(data.scenes ?? []);
        setAssets(data.assets ?? []);
        setValidation(data.validationReport ?? null);
        setManualDurationSec(
          data.selectedContent?.targetDurationSeconds ?? 70
        );
      }
    } catch {
      // ignore fetch error
    }
  };

  const handleSynthesizeTTS = async () => {
    if (!selectedContentId) return;
    setSynthesizing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId:SelectedContentIdOrFallback() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menjalankan sintesis TTS.");
      }

      setScenes(data.scenes ?? []);
      setAssets((prev) => [data.voiceAsset, ...prev]);
      setValidation(data.validationReport ?? null);
      setFeedback({
        type: "success",
        text: `Voice-over berhasil dibuat (${data.voiceAsset.originalFilename}) dan narasi otomatis dibagi menjadi ${data.scenes.length} scene tanpa memotong kalimat.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menjalankan sintesis suara.",
      });
    } finally {
      setSynthesizing(false);
    }
  };

  function SelectedContentIdOrFallback() {
    return selectedContentId || items[0]?.id || "";
  }

  const handleManualMp3Upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!audioFile || !selectedContentId) return;
    setUploadingMp3(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("contentId", selectedContentId);
      formData.append("audioFile", audioFile);
      formData.append("durationSeconds", String(manualDurationSec));
      if (alignmentJsonText.trim()) {
        formData.append("alignmentJson", alignmentJsonText.trim());
      }

      const res = await fetch("/api/voice", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengunggah MP3 manual.");
      }

      setScenes(data.scenes ?? []);
      setAssets((prev) => [data.voiceAsset, ...prev]);
      setValidation(data.validationReport ?? null);
      setAudioFile(null);
      setFeedback({
        type: "success",
        text: `File audio ${data.voiceAsset.originalFilename} berhasil diunggah dan dibagi menjadi ${data.scenes.length} scene.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal mengunggah file audio.",
      });
    } finally {
      setUploadingMp3(false);
    }
  };

  const startEditScene = (sc: SceneRecord) => {
    setEditingSceneId(sc.id);
    setSceneDraft({
      startMs: sc.startMs,
      endMs: sc.endMs,
      narrationText: sc.narrationText,
      visualAction: sc.visualAction,
      cameraDirection: sc.cameraDirection,
    });
  };

  const handleSaveSceneEdit = async (sceneId: string) => {
    if (!sceneDraft || !selectedContentId) return;
    setSavingScene(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: selectedContentId,
          sceneId,
          ...sceneDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan scene.");
      }

      setScenes(data.scenes ?? []);
      setValidation(data.validationReport ?? null);
      setEditingSceneId(null);
      setSceneDraft(null);
      setFeedback({
        type: "success",
        text: "Batas waktu dan rincian scene berhasil disesuaikan secara manual (status: manually_adjusted).",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan penyesuaian scene.",
      });
    } finally {
      setSavingScene(false);
    }
  };

  const voiceAssets = assets.filter((a) => a.assetType === "voice_audio");

  return (
    <div className="space-y-6">
      {/* Content Selector Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center">
        <div className="space-y-1">
          <label
            htmlFor="contentSelect"
            className="block text-xs font-semibold uppercase tracking-wider text-stone-500"
          >
            Pilih Konten untuk Proses Suara & Pemotongan Scene
          </label>
          <select
            id="contentSelect"
            value={selectedContentId}
            onChange={(e) => handleSelectContent(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-900 sm:w-96 sm:text-sm"
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.contentCode} — {item.title} ({item.contentStatus})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge label={`TTS: ${ttsProviderLabel}`} variant="info" />
          <StatusBadge
            label={`Target Scene: ${settings.targetSceneSecondsMin}–${settings.targetSceneSecondsMax} dtk`}
            variant="neutral"
          />
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

      {selectedContent ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Option A: Synthesize via TTS Provider */}
          <SectionCard
            title="Opsi A: Generate Suara Otomatis & Bagi Scene (TTS Adapter)"
            description="Mengirim narasi yang sudah disetujui ke adapter TTS dan otomatis memotong scene pada batas kalimat alami."
            badge={<StatusBadge label="Otomatis" variant="success" />}
          >
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="font-semibold text-stone-800">
                  Narasi Aktif ({selectedContent.contentCode}):
                </p>
                <p className="mt-1 text-stone-700 leading-relaxed">
                  {selectedContent.narration ||
                    "(Narasi masih kosong — silakan isi di Content Library)"}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-stone-500">
                  Target durasi konten: {selectedContent.targetDurationSeconds}{" "}
                  detik
                </span>
                <button
                  type="button"
                  disabled={synthesizing || !selectedContent.narration}
                  onClick={handleSynthesizeTTS}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" />
                  <span>
                    {synthesizing
                      ? "Memproses Suara & Scene..."
                      : "Generate Voice-Over & Potong Scene"}
                  </span>
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Option B: Manual MP3 Upload + Optional Alignment JSON */}
          <SectionCard
            title="Opsi B: Unggah MP3 Manual & Impor Timestamp (Fallback)"
            description="Jika Anda memiliki file audio narasi rekaman sendiri atau eksternal, unggah MP3/WAV-nya di sini."
            badge={<StatusBadge label="Fallback Aman" variant="info" />}
          >
            <form
              onSubmit={handleManualMp3Upload}
              className="space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-stone-700">
                    Pilih File Audio (.mp3 / .wav)
                  </label>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav"
                    onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs text-stone-700 file:mr-2 file:rounded-lg file:border-0 file:bg-amber-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-amber-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="manualDurationSec"
                    className="block font-medium text-stone-700"
                  >
                    Durasi Audio (dtk)
                  </label>
                  <input
                    id="manualDurationSec"
                    type="number"
                    min={5}
                    max={300}
                    value={manualDurationSec}
                    onChange={(e) =>
                      setManualDurationSec(Number(e.target.value))
                    }
                    className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="alignmentJsonText"
                  className="block font-medium text-stone-700"
                >
                  JSON Word Alignment (Opsional — Kosongkan untuk Estimasi Proporsional{" "}
                  <code>ESTIMATED</code>)
                </label>
                <textarea
                  id="alignmentJsonText"
                  rows={2}
                  placeholder='[{"word":"Saat","startMs":0,"endMs":320},{"word":"kucing","startMs":320,"endMs":780}]'
                  value={alignmentJsonText}
                  onChange={(e) => setAlignmentJsonText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-1.5 font-mono text-[11px] text-stone-900"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!audioFile || uploadingMp3}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 font-semibold text-stone-800 hover:bg-stone-100 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 text-amber-600" />
                  <span>
                    {uploadingMp3
                      ? "Mengunggah..."
                      : "Unggah MP3 & Bagi Scene"}
                  </span>
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      ) : null}

      {/* Persisted Voice Assets */}
      {voiceAssets.length > 0 ? (
        <SectionCard
          title="Aset Suara Tersimpan"
          description="Metadata provider, model, durasi, dan status timestamp tercatat di database."
          badge={
            <StatusBadge
              label={`${voiceAssets.length} File Audio`}
              variant="success"
            />
          }
        >
          <div className="space-y-2 text-xs">
            {voiceAssets.map((va) => {
              const tsStatus = String(
                va.metadata?.timestampStatus ?? "estimated"
              );
              return (
                <div
                  key={va.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Volume2 className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="font-semibold text-stone-900">
                        {va.originalFilename}
                      </p>
                      <p className="text-stone-500">
                        Provider: {String(va.metadata?.providerKey ?? "-")} (
                        {String(va.metadata?.providerModel ?? "-")}) • Durasi:{" "}
                        {va.durationMs ? formatMs(va.durationMs) : "-"} •
                        Ukuran: {Math.round(va.sizeBytes / 1024)} KB
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    label={
                      tsStatus === "actual"
                        ? "TIMESTAMP: ACTUAL"
                        : "TIMESTAMP: ESTIMATED"
                    }
                    variant={tsStatus === "actual" ? "success" : "warning"}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      ) : null}

      {/* Scene Segmentation & Validation Report */}
      <SectionCard
        title={`Daftar Segmen Scene (${scenes.length} Scene)`}
        description="Setiap scene dipotong pada batas kalimat alami dan divalidasi agar tidak ada satu pun kata narasi yang hilang atau terduplikasi."
        badge={
          validation ? (
            <StatusBadge
              label={
                validation.valid
                  ? "100% Coverage & Urutan Valid"
                  : "Perlu Perbaikan"
              }
              variant={validation.valid ? "success" : "danger"}
            />
          ) : (
            <StatusBadge label="Belum Ada Scene" variant="neutral" />
          )
        }
      >
        {validation ? (
          <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
            <StatusBadge
              label={`Cakupan Narasi: ${
                validation.textCoverageValid ? "100% Utuh" : "Tidak Cocok"
              }`}
              variant={validation.textCoverageValid ? "success" : "danger"}
            />
            <StatusBadge
              label={`Urutan Waktu: ${
                validation.timestampsOrdered ? "Berurutan" : "Overlap/Error"
              }`}
              variant={validation.timestampsOrdered ? "success" : "danger"}
            />
            {validation.overlongSceneIndices.length > 0 ? (
              <StatusBadge
                label={`Scene > ${
                  settings.targetSceneSecondsMax
                }s: #${validation.overlongSceneIndices.join(", #")}`}
                variant="warning"
              />
            ) : null}
            {validation.shortSceneIndices.length > 0 ? (
              <StatusBadge
                label={`Scene < ${
                  settings.targetSceneSecondsMin
                }s: #${validation.shortSceneIndices.join(", #")}`}
                variant="warning"
              />
            ) : null}
          </div>
        ) : null}

        {scenes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-xs text-stone-500">
            <Scissors className="mx-auto h-6 w-6 text-stone-400 mb-2" />
            <p>
              Belum ada segmen scene untuk konten ini. Klik{" "}
              <strong>Generate Voice-Over & Potong Scene</strong> atau unggah MP3 di atas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scenes.map((sc) => {
              const isEditing = editingSceneId === sc.id;
              return (
                <div
                  key={sc.id}
                  className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        Scene #{sc.sceneIndex}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-stone-700">
                        <Clock className="h-3.5 w-3.5 text-stone-500" />
                        {formatMs(sc.startMs)} &rarr; {formatMs(sc.endMs)} (
                        {formatMs(sc.durationMs)})
                      </span>
                      <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] text-stone-600">
                        {sc.expectedFilename}
                      </code>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge
                        label={
                          sc.timestampStatus === "actual"
                            ? "ACTUAL"
                            : sc.timestampStatus === "manually_adjusted"
                            ? "MANUALLY ADJUSTED"
                            : "ESTIMATED"
                        }
                        variant={
                          sc.timestampStatus === "actual"
                            ? "success"
                            : sc.timestampStatus === "manually_adjusted"
                            ? "info"
                            : "warning"
                        }
                      />
                      {sc.durationFlag !== "ok" ? (
                        <StatusBadge
                          label={
                            sc.durationFlag === "too_long"
                              ? `Durasi Panjang (> ${settings.targetSceneSecondsMax}s)`
                              : `Durasi Pendek (< ${settings.targetSceneSecondsMin}s)`
                          }
                          variant="warning"
                        />
                      ) : null}
                    </div>
                  </div>

                  {isEditing && sceneDraft ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Start (ms)
                          </label>
                          <input
                            type="number"
                            value={sceneDraft.startMs}
                            onChange={(e) =>
                              setSceneDraft({
                                ...sceneDraft,
                                startMs: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-stone-700">
                            End (ms)
                          </label>
                          <input
                            type="number"
                            value={sceneDraft.endMs}
                            onChange={(e) =>
                              setSceneDraft({
                                ...sceneDraft,
                                endMs: Number(e.target.value),
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700">
                          Teks Segmen Narasi (Total teks seluruh scene harus tetap utuh)
                        </label>
                        <textarea
                          rows={2}
                          value={sceneDraft.narrationText}
                          onChange={(e) =>
                            setSceneDraft({
                              ...sceneDraft,
                              narrationText: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Aksi Visual Origami
                          </label>
                          <input
                            type="text"
                            value={sceneDraft.visualAction}
                            onChange={(e) =>
                              setSceneDraft({
                                ...sceneDraft,
                                visualAction: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Arahan Kamera
                          </label>
                          <input
                            type="text"
                            value={sceneDraft.cameraDirection}
                            onChange={(e) =>
                              setSceneDraft({
                                ...sceneDraft,
                                cameraDirection: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSceneId(null);
                            setSceneDraft(null);
                          }}
                          className="rounded border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={savingScene}
                          onClick={() => handleSaveSceneEdit(sc.id)}
                          className="inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Simpan Penyesuaian</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 rounded-lg bg-stone-50 p-2.5 text-xs font-medium text-stone-900 leading-relaxed">
                        &ldquo;{sc.narrationText}&rdquo;
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-600">
                        <div>
                          <span>
                            <strong>Visual:</strong> {sc.visualAction}
                          </span>
                          <span className="mx-1.5">•</span>
                          <span>
                            <strong>Kontinuitas:</strong> {sc.continuityNotes}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditScene(sc)}
                          className="inline-flex shrink-0 items-center gap-1 rounded border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Sesuaikan Timestamp</span>
                        </button>
                      </div>
                    </>
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
