import { publish } from "@flowpanel/kit/next";
import { marketplaceLabel } from "../data/marketplaces";
import { findProductStory, PRODUCT_STORIES } from "../data/scenarios";
import { MARKETPLACES } from "../data/types";
import {
  LIVE_OPERATIONS_CHANNEL,
  LIVE_OPERATIONS_INTERVAL_MS,
  type LiveOperationsSnapshot,
  type MarketEvent,
  type MarketEventKind,
} from "./types";

const BUFFER_LIMIT = 20;
const HISTORY_LIMIT = 36;
const SNAPSHOT_LIMIT = 5;
const BASE_PAGE_RATE = 26;
const LIVE_SIGNAL_VERSION = 3;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const THROUGHPUT_JITTER = [2, -3, 4, -1, 3, -2, 1, -4, 3, 0] as const;
const KINDS: readonly MarketEventKind[] = [
  "price_drop",
  "price_rise",
  "stock_change",
  "crawl_progress",
];

function nextPageRate(previous: number, index: number): number {
  const baseline = index % 40 < 20 ? 28 : 24;
  const correction = Math.round((baseline - previous) * 0.25);
  const jitter = THROUGHPUT_JITTER[index % THROUGHPUT_JITTER.length] ?? 0;
  const slowPage = index % 17 === 0 ? -6 : index % 11 === 0 ? 5 : 0;
  return Math.max(14, Math.min(38, previous + correction + jitter + slowPage));
}

export function createMarketEvent(index: number, at: Date): MarketEvent {
  const selected = PRODUCT_STORIES[index % PRODUCT_STORIES.length];
  if (!selected) throw new Error("Market activity requires at least one product story");
  const product = findProductStory(selected.key);
  const marketplace = MARKETPLACES[index % MARKETPLACES.length] ?? "amazon";
  const kind = KINDS[index % KINDS.length] ?? "crawl_progress";
  const delta = 3 + ((index * 7) % 15);
  const details: Record<MarketEventKind, string> = {
    price_drop: `Price dropped ${delta}% to ${usd.format((product.ourPriceCents * (100 - delta)) / 10_000)}`,
    price_rise: `Price rose ${delta}% to ${usd.format((product.ourPriceCents * (100 + delta)) / 10_000)}`,
    stock_change: index % 2 === 0 ? "Back in stock" : "Stock is running low",
    crawl_progress: `${24 + (index % 73)} pages crawled so far`,
  };

  return {
    id: index,
    kind,
    title: product.title,
    marketplace: marketplaceLabel(marketplace),
    detail: details[kind],
    at: new Date(at),
  };
}

interface LiveOperationsState {
  signalVersion: number;
  timer: ReturnType<typeof setInterval> | null;
  index: number;
  avgMatchLatencyMs: number;
  pageRateHistory: number[];
  events: MarketEvent[];
}

const STORE_KEY = Symbol.for("scrapeai.marketActivity");
const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: LiveOperationsState };

function createState(): LiveOperationsState {
  const now = Date.now();
  const events = Array.from({ length: SNAPSHOT_LIMIT }, (_, offset) =>
    createMarketEvent(
      SNAPSHOT_LIMIT - offset,
      new Date(now - offset * LIVE_OPERATIONS_INTERVAL_MS),
    ),
  );
  const pageRateHistory = [BASE_PAGE_RATE - 4];
  for (let index = 1; index < HISTORY_LIMIT; index += 1) {
    pageRateHistory.push(nextPageRate(pageRateHistory[index - 1] ?? BASE_PAGE_RATE, index));
  }

  return {
    signalVersion: LIVE_SIGNAL_VERSION,
    timer: null,
    index: HISTORY_LIMIT + SNAPSHOT_LIMIT,
    avgMatchLatencyMs: 640,
    pageRateHistory,
    events,
  };
}

function state(): LiveOperationsState {
  globalStore[STORE_KEY] ??= createState();
  const current = globalStore[STORE_KEY];
  // A dev-server reload keeps the module instance but may have changed the shape.
  // Refill in place so the running ticker keeps its reference.
  if (current.signalVersion !== LIVE_SIGNAL_VERSION) {
    const wasRunning = current.timer !== null;
    if (current.timer) clearInterval(current.timer);
    Object.assign(current, createState(), { timer: null });
    if (wasRunning) startTicker(current);
  }
  return current;
}

function startTicker(current: LiveOperationsState): void {
  current.timer = setInterval(() => {
    void publish(LIVE_OPERATIONS_CHANNEL, advance(current));
  }, LIVE_OPERATIONS_INTERVAL_MS);
}

function snapshot(current: LiveOperationsState): LiveOperationsSnapshot {
  return {
    pageRateHistory: current.pageRateHistory.slice(-HISTORY_LIMIT),
    avgMatchLatencyMs: current.avgMatchLatencyMs,
    events: current.events.slice(0, SNAPSHOT_LIMIT),
  };
}

function advance(current: LiveOperationsState): LiveOperationsSnapshot {
  current.index += 1;
  const previous = current.pageRateHistory.at(-1) ?? BASE_PAGE_RATE;
  current.pageRateHistory.push(nextPageRate(previous, current.index));
  if (current.pageRateHistory.length > HISTORY_LIMIT) current.pageRateHistory.shift();
  current.avgMatchLatencyMs = 520 + ((current.index * 37) % 320);
  current.events.unshift(createMarketEvent(current.index, new Date()));
  if (current.events.length > BUFFER_LIMIT) current.events.length = BUFFER_LIMIT;
  return snapshot(current);
}

export function getLiveOperationsSnapshot(): LiveOperationsSnapshot {
  return snapshot(state());
}

export function startLiveOperationsTicker(): void {
  if (process.env.DEMO_LIVE === "off") return;
  const current = state();
  if (current.timer) return;
  startTicker(current);
}
