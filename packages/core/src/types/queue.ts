import type { NavGroupRef } from "./dashboard";
import type { IconName } from "./icon";
import type { AccessRule } from "./policy";

export interface QueueOptions {
  /** Nav entry and page title for this queue. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Keep the queue route registered but omit it from primary navigation. */
  hidden?: boolean;
  /** Sidebar group for this queue. Default: the Queues group. */
  navGroup?: NavGroupRef;
  /** Full URL (e.g., http://localhost:3001/queue/email) to the bull-board UI. */
  boardUrl: string;
  /**
   * The board server's `auth.secret`. The page then adds a link signed for this queue that expires
   * in a minute, so the secret itself never reaches the browser.
   */
  boardSecret?: string | undefined;
  /** Optional explicit key; defaults to queue.name. */
  key?: string;
  /** Who may see and open this queue page. */
  access?: AccessRule;
}

/** A BullMQ `Queue`, or any object whose `name` is the queue's key. */
export interface QueueRef {
  readonly name?: string;
}

export interface QueueConfig {
  __kind: "queue";
  ref: QueueRef;
  options: QueueOptions;
}
