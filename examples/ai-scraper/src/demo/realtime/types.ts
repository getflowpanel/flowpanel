export const LIVE_OPERATIONS_CHANNEL = "market-activity";
export const LIVE_OPERATIONS_INTERVAL_MS = 2_000;

export type MarketEventKind = "price_drop" | "price_rise" | "stock_change" | "crawl_completed";

export interface MarketEvent {
  id: number;
  kind: MarketEventKind;
  title: string;
  marketplace: string;
  detail: string;
  at: Date;
}

export interface LiveOperationsSnapshot {
  connected: boolean;
  offersPerMinute: number;
  priceChangesToday: number;
  concurrentCrawls: number;
  avgMatchLatencyMs: number;
  /** Recent offers/min samples, oldest to newest. */
  throughputHistory: readonly number[];
  /** Newest first. Public snapshots contain at most five events. */
  events: readonly MarketEvent[];
}

export interface LiveOperationsProps {
  initial: LiveOperationsSnapshot;
}
