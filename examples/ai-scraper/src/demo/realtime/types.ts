export const MARKET_ACTIVITY_CHANNEL = "market-activity";
export const MARKET_ACTIVITY_INTERVAL_MS = 2_000;

export type MarketEventKind = "price_drop" | "price_rise" | "stock_change" | "crawl_completed";

export interface MarketEvent {
  id: number;
  kind: MarketEventKind;
  title: string;
  marketplace: string;
  detail: string;
  at: Date;
}

export interface MarketActivitySnapshot {
  connected: boolean;
  offersPerMinute: number;
  activeMonitors: number;
  /** Newest first. Public snapshots contain at most five events. */
  events: readonly MarketEvent[];
}

export interface MarketActivityProps {
  initial: MarketActivitySnapshot;
}
