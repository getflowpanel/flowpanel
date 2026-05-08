export interface QueueOptions {
  label: string;
  /** Full URL (e.g., http://localhost:3001/scraper) to the bull-board UI. */
  boardUrl: string;
  /** Optional explicit key; defaults to queue.name. */
  key?: string;
  /** Role required to access this queue page. */
  requireRole?: string | string[];
}

export interface QueueConfig {
  __kind: "queue";
  ref: unknown; // BullMQ Queue instance
  options: QueueOptions;
}
