export const LIVE_OPERATIONS_CHANNEL = "market-activity";
export const LIVE_OPERATIONS_INTERVAL_MS = 2_000;

export type MarketEventKind = "price_drop" | "price_rise" | "stock_change" | "crawl_progress";

export interface MarketEvent {
  id: number;
  kind: MarketEventKind;
  title: string;
  marketplace: string;
  detail: string;
  at: Date;
}

export interface LiveOperationsSnapshot {
  /** Pages one running crawl fetches per minute, in tenths, oldest to newest. */
  pageRateHistory: readonly number[];
  avgMatchLatencyMs: number;
  /** Newest first. Public snapshots contain at most five events. */
  events: readonly MarketEvent[];
}

export interface LiveOperationsProps {
  initial: LiveOperationsSnapshot;
  /** Runs in the `running` state, which the page rate is multiplied by. */
  running: number;
  /** Listings stored for this workspace. */
  tracked: number;
}
