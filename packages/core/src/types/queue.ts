import type { IconName } from "./icon";

export interface QueueOptions {
  /** Nav entry and page title for this queue. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Keep the queue route registered but omit it from primary navigation. */
  hidden?: boolean;
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
