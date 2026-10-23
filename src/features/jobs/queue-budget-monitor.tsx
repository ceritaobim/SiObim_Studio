"use client";

import { useState, type FormEvent } from "react";
import {
  Activity,
  DollarSign,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  XCircle,
  Plus,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import type {
  BudgetLedgerRecord,
  ProductionJobRecord,
} from "@/types/domain";
import type {
  BatchCostScenarioEstimate,
  BudgetGuardEvaluation,
} from "@/lib/costs/budget-guard";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

interface QueueBudgetMonitorProps {
  initialJobs: ProductionJobRecord[];
  initialLedger: BudgetLedgerRecord[];
  initialBudgetSummary: BudgetGuardEvaluation;
  initialCostEstimate: BatchCostScenarioEstimate;
}

export function QueueBudgetMonitor({
  initialJobs,
  initialLedger,
  initialBudgetSummary,
  initialCostEstimate,
}: QueueBudgetMonitorProps) {
  const [jobs, setJobs] = useState<ProductionJobRecord[]>(initialJobs);
  const [ledger, setLedger] = useState<BudgetLedgerRecord[]>(initialLedger);
  const [budgetSummary, setBudgetSummary] =
    useState<BudgetGuardEvaluation>(initialBudgetSummary);
  const [costEstimate] =
    useState<BatchCostScenarioEstimate>(initialCostEstimate);

  const [providerKey, setProviderKey] = useState("elevenlabs-tts");
  const [eventType, setEventType] =
    useState<BudgetLedgerRecord["eventType"]>("charge");
  const [amount, setAmount] = useState("0.25");
  const [notes, setNotes] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleJobAction = async (
    jobId: string,
    action: "pause" | "resume" | "cancel" | "retry"
  ) => {
    setLoadingAction(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memproses kontrol job.");
      }

      setJobs((prev) =>
        prev.map((j) => (j.id === data.job.id ? data.job : j))
      );
      setFeedback({
        type: "success",
        text: `Status job berhasil diperbarui ke "${data.job.status}".`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memproses kontrol job.",
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleAddLedger = async (e: FormEvent) => {
    e.preventDefault();
    setLoadingAction(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_ledger",
          providerKey,
          eventType,
          amount: Number(amount) || 0,
          unit: "USD",
          notes: notes || "Pencatatan biaya produksi manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menambah catatan biaya.");
      }

      setLedger(data.budgetLedger ?? []);
      setBudgetSummary(data.budgetSummary);
      setNotes("");
      setFeedback({
        type: "success",
        text: "Catatan buku besar biaya (Budget Ledger) berhasil disimpan.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Gagal menambah catatan biaya.",
      });
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cost Estimator & Budget Guard */}
        <SectionCard
          title="Budget Guard & Skenario Biaya Batch Mingguan"
          description="Menghitung estimasi skenario terbaik, ekspektasi, dan terburuk (termasuk batas retry) serta memblokir panggilan API baru jika batas anggaran harian/bulanan terlampaui."
          badge={
            <StatusBadge
              label={
                budgetSummary.allowed
                  ? "Anggaran Aman"
                  : "Batas Anggaran Tercapai"
              }
              variant={budgetSummary.allowed ? "success" : "danger"}
            />
          }
        >
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                <p className="text-[11px] text-stone-500">Pemakaian Hari Ini</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-stone-900">
                  ${budgetSummary.spentTodayUsd.toFixed(2)} / $
                  {budgetSummary.dailyLimitUsd.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-2.5">
                <p className="text-[11px] text-stone-500">Pemakaian Bulan Ini</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-stone-900">
                  ${budgetSummary.spentThisMonthUsd.toFixed(2)} / $
                  {budgetSummary.monthlyLimitUsd.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
                <p className="text-[11px] text-emerald-800">
                  Best / Expected ({costEstimate.videoCount} Video)
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-emerald-950">
                  ${costEstimate.bestCaseUsd.toFixed(2)} / $
                  {costEstimate.expectedCaseUsd.toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                <p className="text-[11px] text-amber-800">
                  Worst Case (Max Retry)
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-amber-950">
                  ${costEstimate.worstCaseUsd.toFixed(2)}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-stone-600">{costEstimate.notes}</p>

            {/* Add Ledger Form */}
            <form
              onSubmit={handleAddLedger}
              className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-4"
            >
              <div>
                <label className="block text-[11px] font-medium text-stone-700">
                  Provider
                </label>
                <input
                  type="text"
                  value={providerKey}
                  onChange={(e) => setProviderKey(e.target.value)}
                  className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-700">
                  Tipe Event
                </label>
                <select
                  value={eventType}
                  onChange={(e) =>
                    setEventType(
                      e.target.value as BudgetLedgerRecord["eventType"]
                    )
                  }
                  className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="charge">Charge (Biaya Aktual)</option>
                  <option value="estimate">Estimate</option>
                  <option value="refund">Refund / Kredit</option>
                  <option value="manual_note">Catatan Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-700">
                  Jumlah (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1 text-xs"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loadingAction}
                  className="inline-flex w-full items-center justify-center gap-1 rounded bg-stone-900 px-3 py-1.5 font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Catat Ledger</span>
                </button>
              </div>
            </form>

            {ledger.length > 0 ? (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                {ledger.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-3 py-1.5 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 text-amber-600" />
                      <span className="font-semibold text-stone-800">
                        {item.providerKey}
                      </span>
                      <span className="text-stone-500">({item.eventType})</span>
                    </div>
                    <span className="font-mono font-semibold text-stone-900">
                      ${item.amount.toFixed(4)} {item.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        {/* Durable Job Queue Monitor */}
        <SectionCard
          title="Durable Production Job Queue (Idempotent Worker)"
          description="Setiap langkah menyimpan idempotency_key deterministik. Langkah yang sudah SUCCEEDED tidak akan dijalankan ulang saat retry."
          badge={
            <StatusBadge
              label={`${jobs.length} Job Tercatat`}
              variant="info"
            />
          }
        >
          {jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
              <Activity className="mx-auto h-5 w-5 text-stone-400 mb-1.5" />
              <p>
                Belum ada antrean job yang terekam. Jalankan sintesis suara atau perakitan video untuk merekam jejak job idempoten.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border border-stone-200 bg-stone-50/70 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-stone-900">
                        {job.jobType}
                      </span>
                      <StatusBadge
                        label={job.status.toUpperCase()}
                        variant={
                          job.status === "succeeded"
                            ? "success"
                            : job.status === "failed"
                            ? "danger"
                            : job.status === "paused"
                            ? "warning"
                            : "info"
                        }
                      />
                    </div>
                    <span className="font-mono text-[11px] text-stone-500">
                      Percobaan {job.attemptCount}/{job.maxAttempts} •{" "}
                      {job.progressPercent}%
                    </span>
                  </div>

                  <p className="mt-1 font-mono text-[11px] text-stone-600 truncate">
                    Key: {job.idempotencyKey} • Provider: {job.providerKey}
                  </p>

                  {job.safeErrorMessage ? (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-rose-700">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{job.safeErrorMessage}</span>
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {job.status === "running" || job.status === "queued" ? (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleJobAction(job.id, "pause")}
                        className="inline-flex items-center gap-1 rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100"
                      >
                        <PauseCircle className="h-3 w-3" />
                        <span>Pause</span>
                      </button>
                    ) : null}

                    {job.status === "paused" ? (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleJobAction(job.id, "resume")}
                        className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100"
                      >
                        <PlayCircle className="h-3 w-3" />
                        <span>Resume</span>
                      </button>
                    ) : null}

                    {job.status === "failed" && job.retryable ? (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleJobAction(job.id, "retry")}
                        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Retry Failed Step</span>
                      </button>
                    ) : null}

                    {job.status !== "succeeded" &&
                    job.status !== "cancelled" ? (
                      <button
                        type="button"
                        disabled={loadingAction}
                        onClick={() => handleJobAction(job.id, "cancel")}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100"
                      >
                        <XCircle className="h-3 w-3" />
                        <span>Cancel</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
