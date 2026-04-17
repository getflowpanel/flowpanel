/**
 * Queue types: abstract interface that any queueing system (BullMQ, pgmq, SQS…)
 * can implement to expose inspection & control to the FlowPanel admin.
 *
 * Design notes:
 *  - Read-first: the list/get/status operations always work.
 *  - Control ops (retry/remove/pause/resume/drain) return `{ ok: true }` on success.
 *  - State names are standardized across queue implementations.
 */

export type JobState = "active" | "waiting" | "completed" | "failed" | "delayed" | "paused";

export interface QueueJob {
  id: string;
  name: string;
  data: unknown;
  state: JobState;
  /** 0–100, if the queue exposes progress. */
  progress?: number;
  attemptsMade: number;
  maxAttempts?: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
  /** ISO string or unix ms — consumer should not assume. */
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  /** Opaque queue-specific metadata (priority, delay, repeat, …). */
  opts?: Record<string, unknown>;
}

export interface QueueStatus {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  /** Sum of all counts — convenience. */
  total: number;
}

export interface GetJobsArgs {
  state?: JobState;
  limit?: number;
  offset?: number;
}

export interface QueueAdapter {
  /** Queue name/identifier. */
  name: string;
  /** Optional human label. Defaults to `name`. */
  label?: string;

  getStatus(): Promise<QueueStatus>;
  getJobs(args: GetJobsArgs): Promise<{ jobs: QueueJob[]; total: number }>;
  getJob(id: string): Promise<QueueJob | null>;

  retry(id: string): Promise<void>;
  remove(id: string): Promise<void>;

  pause?(): Promise<void>;
  resume?(): Promise<void>;
  drain?(): Promise<void>;
  /** Remove all jobs of a given terminal state. */
  clean?(state: "completed" | "failed", olderThanMs?: number): Promise<number>;
}

// ---------------------------------------------------------------------------
// Resolved + Serialized shapes
// ---------------------------------------------------------------------------

export interface ResolvedQueue {
  id: string;
  name: string;
  label: string;
  adapter: QueueAdapter;
}

export interface SerializedQueue {
  id: string;
  name: string;
  label: string;
  capabilities: {
    pause: boolean;
    resume: boolean;
    drain: boolean;
    clean: boolean;
  };
}
