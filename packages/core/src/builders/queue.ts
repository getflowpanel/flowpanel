import type { QueueConfig, QueueOptions } from "../types/queue";

/** Register a BullMQ queue in your FlowPanel admin. */
export function queue(ref: unknown, options: QueueOptions): QueueConfig {
  return { __kind: "queue", ref, options };
}
