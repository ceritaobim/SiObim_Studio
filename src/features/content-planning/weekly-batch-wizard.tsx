"use client";

import { useState, type FormEvent } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Edit3,
  AlertTriangle,
  ExternalLink,
  Save,
  Send,
  FolderPlus,
} from "lucide-react";
import type {
  ContentBatchRecord,
  ProjectSettingsSummary,
  ProposalDecision,
  WeeklyPlanProposal,
} from "@/types/domain";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface WeeklyBatchWizardProps {
  initialBatches: ContentBatchRecord[];
  initialSettings: ProjectSettingsSummary;
}

export function WeeklyBatchWizard({
  initialBatches,
  initialSettings,
}: WeeklyBatchWizardProps) {
  const [batches, setBatches] = useState<ContentBatchRecord[]>(initialBatches);
  const [activeBatchId, setActiveBatchId] = useState<string>(
    initialBatches[0]?.id ?? ""
  );

  // New batch form state (pre-filled from project settings)
  const [batchName, setBatchName] = useState(() => {
    const nextIdx = initialBatches.length + 1;
    return `Batch Mingguan #${nextIdx}`;
  });
  const [targetWeekStart, setTargetWeekStart] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [targetVideoCount, setTargetVideoCount] = useState(
    initialSettings.weeklyVideoTarget || 21
  );
  const [customThemeHint, setCustomThemeHint] = useState("");
  const [generating, setGenerating] = useState(false);

  // Proposal editing state
  const [editingProposalId, setEditingProposalId] = useState<string | null>(
    null
  );
  const [editDraft, setEditDraft] = useState<{
    title: string;
    topic: string;
    hook: string;
    narration: string;
    cta: string;
    claimsText: string;
    urlsText: string;
  } | null>(null);

  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [syncToGSheetsOnCommit, setSyncToGSheetsOnCommit] = useState(
    Boolean(initialSettings.googleSheetWebAppUrl)
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  const activeBatch = batches.find((b) => b.id === activeBatchId) ?? batches[0];

  const handleGenerateBatch = async (e: FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchName,
          targetWeekStart,
          targetVideoCount,
          customThemeHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.issues)
          ? ` (${data.issues.join(" • ")})`
          : "";
        throw new Error((data.error || "Gagal membuat batch mingguan.") + detail);
      }

      const created = data.batch as ContentBatchRecord;
      setBatches((prev) => [created, ...prev]);
      setActiveBatchId(created.id);
      setBatchName(`Batch Mingguan #${batches.length + 2}`);
      setCustomThemeHint("");
      setFeedback({
        type: "success",
        text: `${created.proposals.length} usulan konten berhasil dibuat menggunakan ${created.providerKey} (${created.providerModel}). Tinjau fakta dan setujui naskah di bawah.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memanggil LLM planner.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const replaceBatchInState = (updated: ContentBatchRecord) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
  };

  const handleDecisionOrRegenerate = async (
    batchId: string,
    proposalId: string,
    payload: { decision?: ProposalDecision; regenerate?: boolean }
  ) => {
    setBusyProposalId(proposalId);
    setFeedback(null);
    try {
      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_proposal",
          batchId,
          proposalId,
          ...payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui usulan.");
      }
      replaceBatchInState(data.batch as ContentBatchRecord);
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal memperbarui usulan.",
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const startEditProposal = (prop: WeeklyPlanProposal) => {
    setEditingProposalId(prop.proposalId);
    setEditDraft({
      title: prop.title,
      topic: prop.topic,
      hook: prop.hook,
      narration: prop.narration,
      cta: prop.cta,
      claimsText: prop.factualClaims.join("\n"),
      urlsText: prop.sourceUrls.join("\n"),
    });
  };

  const handleSaveProposalEdit = async (
    batchId: string,
    proposalId: string
  ) => {
    if (!editDraft) return;
    setBusyProposalId(proposalId);
    setFeedback(null);

    try {
      const factualClaims = editDraft.claimsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const sourceUrls = editDraft.urlsText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_proposal",
          batchId,
          proposalId,
          title: editDraft.title,
          topic: editDraft.topic,
          hook: editDraft.hook,
          narration: editDraft.narration,
          cta: editDraft.cta,
          factualClaims,
          sourceUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan perubahan naskah.");
      }
      replaceBatchInState(data.batch as ContentBatchRecord);
      setEditingProposalId(null);
      setEditDraft(null);
      setFeedback({
        type: "success",
        text: "Perubahan naskah dan sumber fakta berhasil disimpan.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal menyimpan perubahan naskah.",
      });
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleCommitApproved = async (batchId: string) => {
    setCommitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit_approved",
          batchId,
          syncToGoogleSheet: syncToGSheetsOnCommit,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memasukkan konten ke pustaka.");
      }

      replaceBatchInState(data.batch as ContentBatchRecord);
      const count = Array.isArray(data.appendedItems)
        ? data.appendedItems.length
        : 0;
      const syncMsg = data.gsheetSyncMessage
        ? ` • ${data.gsheetSyncMessage}`
        : "";

      setFeedback({
        type: "success",
        text: `${count} naskah yang disetujui berhasil ditambahkan (append) ke Content Library dengan status script_approved tanpa menimpa konten lama${syncMsg}`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Gagal memasukkan konten yang disetujui ke pustaka.",
      });
    } finally {
      setCommitting(false);
    }
  };

  const approvedUncommittedCount =
    activeBatch?.proposals.filter(
      (p) => p.decision === "approved" && !p.committedContentId
    ).length ?? 0;

  return (
    <div className="space-y-6">
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

      {/* Step 1–3: Create & Generate Weekly Batch */}
      <SectionCard
        title="Langkah 1–3: Buat Batch Mingguan & Generate Perencanaan AI"
        description="Gaya origami stop-motion, bahasa Indonesia, dan histori Content Library otomatis disertakan tanpa perlu diketik ulang."
        badge={<StatusBadge label="Pre-filled dari Settings" variant="info" />}
      >
        <form onSubmit={handleGenerateBatch} className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="batchName"
                className="block font-medium text-stone-700"
              >
                Nama Batch
              </label>
              <input
                id="batchName"
                type="text"
                required
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="targetWeekStart"
                className="block font-medium text-stone-700"
              >
                Minggu Mulai Produksi
              </label>
              <input
                id="targetWeekStart"
                type="date"
                required
                value={targetWeekStart}
                onChange={(e) => setTargetWeekStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
              />
            </div>

            <div>
              <label
                htmlFor="targetVideoCount"
                className="block font-medium text-stone-700"
              >
                Jumlah Usulan Video (1–28)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="targetVideoCount"
                  type="number"
                  min={1}
                  max={28}
                  required
                  value={targetVideoCount}
                  onChange={(e) => setTargetVideoCount(Number(e.target.value))}
                  className="w-24 rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
                />
                <button
                  type="button"
                  onClick={() => setTargetVideoCount(3)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    targetVideoCount === 3
                      ? "border-amber-600 bg-amber-50 text-amber-900"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  ⚡ 3 Konten (1 Hari • 3 Program)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetVideoCount(21)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    targetVideoCount === 21
                      ? "border-amber-600 bg-amber-50 text-amber-900"
                      : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  🔥 21 Konten (1 Minggu • 3/Hari)
                </button>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="customThemeHint"
              className="block font-medium text-stone-700"
            >
              Fokus Tema Minggu Ini (Opsional)
            </label>
            <input
              id="customThemeHint"
              type="text"
              placeholder="Contoh: Fakta hewan laut dalam, fisika sehari-hari, atau teknologi luar angkasa..."
              value={customThemeHint}
              onChange={(e) => setCustomThemeHint(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900"
            />
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs sm:flex-row sm:items-center">
            <div className="space-y-0.5 text-stone-600">
              <p>
                <strong>Aturan Otomatis:</strong> Durasi default{" "}
                {initialSettings.defaultDurationSeconds} detik • Rasio{" "}
                {initialSettings.outputAspectRatio} • Gaya Origami Stop-Motion
              </p>
              <p>
                Klaim tanpa URL sumber otomatis diberi status{" "}
                <code>needs_verification</code>.
              </p>
            </div>
            <button
              type="submit"
              disabled={generating}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 disabled:opacity-50 sm:text-sm"
            >
              <Sparkles className="h-4 w-4" />
              <span>
                {generating
                  ? "Sedang Merencanakan..."
                  : `Generate ${targetVideoCount} Ide Konten`}
              </span>
            </button>
          </div>
        </form>
      </SectionCard>

      {/* Batch Selector & Active Batch Review */}
      {batches.length > 0 && activeBatch ? (
        <SectionCard
          title={`Langkah 4–6: Tinjau Fakta, Setujui Naskah, & Simpan (${activeBatch.batchName})`}
          description={`Provider: ${activeBatch.providerKey} (${activeBatch.providerModel}) • Minggu: ${activeBatch.targetWeekStart} • Estimasi Biaya: $${activeBatch.estimatedTotalCost}`}
          badge={
            <StatusBadge
              label={`Status Batch: ${activeBatch.status}`}
              variant={
                activeBatch.status === "approved" ? "success" : "warning"
              }
            />
          }
        >
          {batches.length > 1 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-100 pb-3 text-xs">
              <span className="font-medium text-stone-600">Pilih Batch:</span>
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBatchId(b.id)}
                  className={`rounded-lg border px-2.5 py-1 font-medium ${
                    b.id === activeBatch.id
                      ? "border-amber-600 bg-amber-50 text-amber-900"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {b.batchName} ({b.proposals.length} ide)
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            {activeBatch.proposals.map((prop) => {
              const isEditing = editingProposalId === prop.proposalId;
              const isBusy = busyProposalId === prop.proposalId;

              return (
                <div
                  key={prop.proposalId}
                  className={`rounded-xl border p-4 transition-colors ${
                    prop.decision === "approved"
                      ? "border-emerald-300 bg-emerald-50/30"
                      : prop.decision === "rejected"
                      ? "border-rose-200 bg-rose-50/20 opacity-75"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-900">
                        {prop.suggestedCode}
                      </span>
                      {prop.programName && (
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                            prop.programName === "Ke Dapur Yuk!"
                              ? "border-amber-300 bg-amber-100 text-amber-900"
                              : prop.programName === "Kepikiran Aja"
                              ? "border-indigo-300 bg-indigo-100 text-indigo-900"
                              : "border-emerald-300 bg-emerald-100 text-emerald-900"
                          }`}
                        >
                          {prop.programName === "Ke Dapur Yuk!"
                            ? "🍳 "
                            : prop.programName === "Kepikiran Aja"
                            ? "🌙 "
                            : "💡 "}
                          {prop.programName}
                        </span>
                      )}
                      <span className="text-xs text-stone-500">
                        {prop.category} • Target {prop.targetDurationSeconds} dtk
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge
                        label={`Verifikasi: ${prop.verificationStatus}`}
                        variant={
                          prop.verificationStatus === "verified"
                            ? "success"
                            : "warning"
                        }
                      />
                      <StatusBadge
                        label={
                          prop.committedContentId
                            ? "Tersimpan di Pustaka"
                            : `Keputusan: ${prop.decision}`
                        }
                        variant={
                          prop.committedContentId ||
                          prop.decision === "approved"
                            ? "success"
                            : prop.decision === "rejected"
                            ? "danger"
                            : "neutral"
                        }
                      />
                    </div>
                  </div>

                  {isEditing && editDraft ? (
                    <div className="mt-3 space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Judul
                          </label>
                          <input
                            type="text"
                            value={editDraft.title}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                title: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Topik
                          </label>
                          <input
                            type="text"
                            value={editDraft.topic}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                topic: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700">
                          Hook Pembuka
                        </label>
                        <input
                          type="text"
                          value={editDraft.hook}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, hook: e.target.value })
                          }
                          className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700">
                          Narasi Lengkap
                        </label>
                        <textarea
                          rows={4}
                          value={editDraft.narration}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              narration: e.target.value,
                            })
                          }
                          className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block font-semibold text-stone-700">
                            Klaim Fakta (1 per baris)
                          </label>
                          <textarea
                            rows={2}
                            value={editDraft.claimsText}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                claimsText: e.target.value,
                              })
                            }
                            className="mt-1 w-full rounded border border-stone-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-stone-700">
                            URL Sumber (1 per baris)
                          </label>
                          <textarea
                            rows={2}
                            value={editDraft.urlsText}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                urlsText: e.target.value,
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
                            setEditingProposalId(null);
                            setEditDraft(null);
                          }}
                          className="rounded border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleSaveProposalEdit(
                              activeBatch.id,
                              prop.proposalId
                            )
                          }
                          className="inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Simpan Perubahan</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3 className="mt-2 text-sm font-bold text-stone-900 sm:text-base">
                        {prop.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-600">
                        <strong>Topik:</strong> {prop.topic}
                      </p>

                      <p className="mt-2 rounded-lg bg-stone-50 p-2.5 text-xs text-stone-800 italic">
                        <strong>Hook:</strong> &ldquo;{prop.hook}&rdquo;
                      </p>

                      <p className="mt-2 text-xs text-stone-700 leading-relaxed">
                        {prop.narration}
                      </p>

                      {prop.duplicateWarnings.length > 0 ? (
                        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                          <div>
                            <strong>Peringatan Kemiripan Topik:</strong>{" "}
                            {prop.duplicateWarnings
                              .map((w) => `${w.existingCode} (${w.reason})`)
                              .join(" • ")}
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-stone-100 pt-2.5 text-xs sm:grid-cols-2">
                        <div>
                          <span className="font-semibold text-stone-700">
                            Klaim Fakta:
                          </span>
                          <ul className="mt-1 list-disc pl-4 text-stone-600 space-y-0.5">
                            {prop.factualClaims.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="font-semibold text-stone-700">
                            URL Sumber Referensi:
                          </span>
                          {prop.sourceUrls.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {prop.sourceUrls.map((u, i) => (
                                <li key={i}>
                                  <a
                                    href={u}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-amber-700 underline break-all"
                                  >
                                    <span>{u}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-amber-800 font-medium">
                              ⚠️ Belum ada URL sumber — ditandai{" "}
                              <code>needs_verification</code>.Klik Edit untuk menambahkan sumber.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Proposal Action Buttons */}
                  {!prop.committedContentId ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleDecisionOrRegenerate(
                              activeBatch.id,
                              prop.proposalId,
                              { decision: "approved" }
                            )
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold ${
                            prop.decision === "approved"
                              ? "bg-emerald-600 text-white"
                              : "border border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Setujui (Approve)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleDecisionOrRegenerate(
                              activeBatch.id,
                              prop.proposalId,
                              { decision: "rejected" }
                            )
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold ${
                            prop.decision === "rejected"
                              ? "bg-rose-600 text-white"
                              : "border border-rose-300 text-rose-700 hover:bg-rose-50"
                          }`}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Tolak (Reject)</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => startEditProposal(prop)}
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit Naskah / Sumber</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleDecisionOrRegenerate(
                              activeBatch.id,
                              prop.proposalId,
                              { regenerate: true }
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${
                              isBusy ? "animate-spin" : ""
                            }`}
                          />
                          <span>Ganti Ide (Regenerate)</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Commit Approved Bar */}
          <div className="mt-5 flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs text-amber-950">
              <p className="font-semibold">
                Siap Dimasukkan ke Content Library: {approvedUncommittedCount}{" "}
                Naskah Disetujui
              </p>
              <label className="inline-flex items-center gap-2 text-amber-900">
                <input
                  type="checkbox"
                  checked={syncToGSheetsOnCommit}
                  onChange={(e) => setSyncToGSheetsOnCommit(e.target.checked)}
                  className="rounded border-amber-400"
                />
                <span>
                  Otomatis kirim (append) baris baru ke Google Spreadsheet (jika Webhook GSheets diisi)
                </span>
              </label>
            </div>

            <button
              type="button"
              disabled={approvedUncommittedCount === 0 || committing}
              onClick={() => handleCommitApproved(activeBatch.id)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 sm:text-sm"
            >
              {syncToGSheetsOnCommit ? (
                <Send className="h-4 w-4" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              <span>
                {committing
                  ? "Menyimpan..."
                  : `Simpan ${approvedUncommittedCount} Naskah ke Pustaka & Antrean`}
              </span>
            </button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
