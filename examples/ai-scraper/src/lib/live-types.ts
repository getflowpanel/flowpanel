/**
 * Client-safe shared types and constants for the live activity feed.
 *
 * Kept separate from `live-feed.ts` (which imports the server-only publisher)
 * so client widgets can import the channel name and payload shapes without
 * dragging server code — `revalidatePath`, `"use server"` actions — into the
 * browser bundle.
 */
export interface FeedEvent {
  id: number;
  site: string;
  title: string;
  oldPriceCents: number;
  newPriceCents: number;
  /** Signed percent change, e.g. -12 or +6. */
  pctDelta: number;
  direction: "drop" | "rise";
  stock: "in_stock" | "low_stock" | "out_of_stock";
  at: number;
}

export interface LiveStats {
  /** Listings crawled per minute (the sparkline series). */
  listingsPerMin: number;
  /** Price changes detected today (climbing counter). */
  priceChangesToday: number;
  /** Concurrent crawls right now. */
  activeCrawls: number;
  /** Avg AI match latency in ms. */
  avgMatchLatencyMs: number;
  /** Recent listings/min samples, oldest → newest, for the sparkline. */
  history: number[];
}

/**
 * One tick's payload on the `live` channel. A `kind` tag is required because
 * the realtime bus broadcasts every message to every subscriber (one SSE
 * connection for all channels), so widgets must recognise their own payloads
 * and ignore others (e.g. `resource.*` mutation events).
 */
export interface LivePayload {
  kind: "live";
  recent: FeedEvent[];
  stats: LiveStats;
}

export const LIVE_CHANNEL = "live";

/** Ticker interval (ms). Shared so the server's publish cadence and the
 *  client's sparkline x-axis spacing stay in lockstep. */
export const TICK_MS = 2200;
