import crypto from "crypto";
import type {
  JobStatus,
  JobStepType,
  ProductionJobRecord,
} from "@/types/domain";

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "paused", "cancelled", "waiting_for_user"],
  running: ["succeeded", "failed", "paused", "waiting_for_user", "cancelled"],
  waiting_for_user: ["queued", "running", "cancelled", "paused"],
  failed: ["queued", "running", "cancelled"],
  paused: ["queued", "running", "cancelled"],
  succeeded: [], // Completed jobs are immutable; retries must not re-run succeeded paid jobs
  cancelled: ["queued"],
};

export function canTransitionJobStatus(
  from: JobStatus,
  to: JobStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function buildDeterministicIdempotencyKey(params: {
  ownerId: string;
  contentId: string;
  jobType: JobStepType;
  inputSignature: string;
}): { idempotencyKey: string; inputHash: string } {
  const inputHash = crypto
    .createHash("sha256")
    .update(params.inputSignature)
    .digest("hex")
    .slice(0, 20);

  const idempotencyKey = `${params.jobType}:${params.contentId}:${inputHash}`;
  return { idempotencyKey, inputHash };
}

/**
 * Transitions a job to a new state while enforcing:
 * - Valid state machine transitions
 * - Maximum retry attempts guard
 * - Idempotency protection (succeeded jobs with output assets are never re-executed)
 */
export function transitionProductionJob(
  job: ProductionJobRecord,
  nextStatus: JobStatus,
  patch?: {
    progressPercent?: number;
    providerRequestId?: string;
    actualCost?: number | null;
    outputAssetIds?: string[];
    errorCode?: string | null;
    safeErrorMessage?: string | null;
  }
): ProductionJobRecord {
  if (job.status === "succeeded" && nextStatus === "running") {
    throw new Error(
      `IDEMPOTENT_SKIP_ALREADY_SUCCEEDED: Job "${job.idempotencyKey}" sudah selesai dan memiliki aset output. Tidak menjalankan ulang panggilan berbayar.`
    );
  }

  if (!canTransitionJobStatus(job.status, nextStatus)) {
    throw new Error(
      `INVALID_JOB_TRANSITION: Tidak dapat mengubah status job dari "${job.status}" ke "${nextStatus}".`
    );
  }

  const now = new Date().toISOString();
  let attemptCount = job.attemptCount;

  if (nextStatus === "running" && job.status !== "running") {
    if (attemptCount >= job.maxAttempts) {
      throw new Error(
        `MAX_ATTEMPTS_EXCEEDED: Job telah mencapai batas maksimum percobaan (${job.maxAttempts}/${job.maxAttempts}).`
      );
    }
    attemptCount += 1;
  }

  const isTerminal =
    nextStatus === "succeeded" ||
    nextStatus === "failed" ||
    nextStatus === "cancelled";

  return {
    ...job,
    status: nextStatus,
    attemptCount,
    progressPercent:
      patch?.progressPercent ??
      (nextStatus === "succeeded" ? 100 : job.progressPercent),
    providerRequestId: patch?.providerRequestId ?? job.providerRequestId,
    actualCost:
      patch?.actualCost !== undefined ? patch.actualCost : job.actualCost,
    outputAssetIds: patch?.outputAssetIds ?? job.outputAssetIds,
    startedAt:
      nextStatus === "running" && !job.startedAt ? now : job.startedAt,
    finishedAt: isTerminal ? now : job.finishedAt,
    errorCode:
      patch?.errorCode !== undefined
        ? patch.errorCode
        : nextStatus === "succeeded"
        ? null
        : job.errorCode,
    safeErrorMessage:
      patch?.safeErrorMessage !== undefined
        ? patch.safeErrorMessage
        : nextStatus === "succeeded"
        ? null
        : job.safeErrorMessage,
    retryable:
      nextStatus === "failed" ? attemptCount < job.maxAttempts : job.retryable,
    updatedAt: now,
  };
}
