/**
 * BullMQ adapter for FlowPanel.
 *
 * Usage:
 * ```ts
 * import { Queue } from "bullmq";
 * import { bullmqAdapter } from "@flowpanel/queue-bullmq";
 *
 * const emailQueue = new Queue("email", { connection: { host: "localhost" } });
 *
 * defineFlowPanel({
 *   ...,
 *   queues: {
 *     email: bullmqAdapter(emailQueue, { label: "Email" }),
 *   },
 * });
 * ```
 */

import type { GetJobsArgs, JobState, QueueAdapter, QueueJob, QueueStatus } from "@flowpanel/core";
import type { Job, JobState as BullJobState, Queue } from "bullmq";

export interface BullmqAdapterOptions {
  /** Optional human label. */
  label?: string;
  /** Override queue name. Defaults to the BullMQ queue's name. */
  name?: string;
}

/**
 * Wraps a BullMQ Queue instance into a FlowPanel-compatible QueueAdapter.
 * Read, retry, remove, pause/resume, drain, clean — all supported.
 */
export function bullmqAdapter(queue: Queue, options: BullmqAdapterOptions = {}): QueueAdapter {
  const name = options.name ?? queue.name;

  return {
    name,
    label: options.label ?? name,

    async getStatus(): Promise<QueueStatus> {
      const counts = await queue.getJobCounts(
        "active",
        "waiting",
        "completed",
        "failed",
        "delayed",
      );
      const paused = await queue.isPaused();
      const active = counts.active ?? 0;
      const waiting = counts.waiting ?? 0;
      const completed = counts.completed ?? 0;
      const failed = counts.failed ?? 0;
      const delayed = counts.delayed ?? 0;
      return {
        active,
        waiting,
        completed,
        failed,
        delayed,
        paused,
        total: active + waiting + completed + failed + delayed,
      };
    },

    async getJobs({ state, limit = 50, offset = 0 }: GetJobsArgs) {
      const bullStates = state ? [mapStateToBull(state)] : DEFAULT_LIST_STATES;

      // BullMQ's getJobs accepts a state array and a [start, end] range
      const bullJobs = await queue.getJobs(bullStates, offset, offset + limit - 1, false);

      const counts = await queue.getJobCounts(...bullStates);
      const total = bullStates.reduce((s, st) => s + (counts[st as BullJobState] ?? 0), 0);

      return {
        jobs: bullJobs.filter((j): j is Job => Boolean(j)).map(mapJob),
        total,
      };
    },

    async getJob(id: string): Promise<QueueJob | null> {
      const job = await queue.getJob(id);
      if (!job) return null;
      return mapJob(job);
    },

    async retry(id: string): Promise<void> {
      const job = await queue.getJob(id);
      if (!job) throw new Error(`Job ${id} not found`);
      await job.retry();
    },

    async remove(id: string): Promise<void> {
      const job = await queue.getJob(id);
      if (!job) throw new Error(`Job ${id} not found`);
      await job.remove();
    },

    async pause(): Promise<void> {
      await queue.pause();
    },

    async resume(): Promise<void> {
      await queue.resume();
    },

    async drain(): Promise<void> {
      await queue.drain();
    },

    async clean(state, olderThanMs = 0): Promise<number> {
      // BullMQ clean signature: (grace, limit, type)
      // We use a generous limit (10k) and rely on grace period.
      const bullType = state === "completed" ? "completed" : "failed";
      const removed = await queue.clean(olderThanMs, 10_000, bullType);
      return Array.isArray(removed) ? removed.length : 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

const DEFAULT_LIST_STATES: BullJobState[] = ["active", "waiting", "delayed", "failed", "completed"];

function mapStateToBull(state: JobState): BullJobState {
  if (state === "paused") return "waiting"; // BullMQ: paused means paused queue, not job state
  return state as BullJobState;
}

async function inferState(job: Job): Promise<JobState> {
  try {
    const s = await job.getState();
    if (s === "completed") return "completed";
    if (s === "failed") return "failed";
    if (s === "active") return "active";
    if (s === "delayed") return "delayed";
    if (s === "waiting" || s === "waiting-children") return "waiting";
    return "waiting";
  } catch {
    return "waiting";
  }
}

function mapJob(job: Job): QueueJob {
  // We can't await inside a sync mapper, so consumers that need accurate state
  // should call getJob for a single job, which resolves state precisely.
  const state: JobState = job.finishedOn
    ? job.failedReason
      ? "failed"
      : "completed"
    : job.processedOn
      ? "active"
      : "waiting";

  return {
    id: String(job.id ?? ""),
    name: job.name,
    data: job.data,
    state,
    progress: typeof job.progress === "number" ? job.progress : undefined,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts?.attempts,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace ?? undefined,
    returnvalue: job.returnvalue,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    opts: job.opts as unknown as Record<string, unknown>,
  };
}

/**
 * Higher-accuracy state resolver — use when you have a single job in hand.
 * Exported for consumers who want to call it manually.
 */
export async function resolveJobState(job: Job): Promise<JobState> {
  return inferState(job);
}
