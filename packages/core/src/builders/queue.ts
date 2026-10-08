import type { QueueConfig, QueueOptions, QueueRef } from "../types/queue";

/** Register a BullMQ queue in your FlowPanel admin. */
export function queue(ref: QueueRef, options: QueueOptions): QueueConfig {
  return { __kind: "queue", ref, options };
}
