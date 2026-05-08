import type { QueueConfig, QueueOptions } from "../types/queue.js";

/**
 * Register a BullMQ queue in your FlowPanel admin. A nav entry appears
 * under /admin/queues/<key>. Pair with @flowpanel/adapter-bullmq's
 * startBoardServer to run the bull-board UI on a separate port.
 *
 * @example
 *   queue(scraperQueue, { label: "Scraper", boardUrl: "http://localhost:3001/scraper" })
 */
export function queue(ref: unknown, options: QueueOptions): QueueConfig {
  return { __kind: "queue", ref, options };
}
