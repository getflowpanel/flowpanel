import { publish } from "@flowpanel/kit/next";
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
const BASE_OFFERS_PER_MINUTE = 132;
const LIVE_SIGNAL_VERSION = 2;
const THROUGHPUT_JITTER = [2, -3, 4, -1, 3, -2, 1, -4, 3, 0] as const;
const KINDS: readonly MarketEventKind[] = [
  "price_drop",
  "price_rise",
  "stock_change",
  "crawl_completed",
];

function nextThroughput(previous: number, index: number): number {
  const baseline = index % 40 < 20 ? 144 : 132;
  const correction = Math.round((baseline - previous) * 0.25);
  const jitter = THROUGHPUT_JITTER[index % THROUGHPUT_JITTER.length] ?? 0;
  const operationalChange = index % 17 === 0 ? -18 : index % 11 === 0 ? 16 : 0;
  return Math.max(96, Math.min(174, previous + correction + jitter + operationalChange));
}

const marketplaceLabel = (value: string) =>
  value
    .split("_")
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join(" ");

export function createMarketEvent(index: number, at: Date): MarketEvent {
  const selected = PRODUCT_STORIES[index % PRODUCT_STORIES.length];
  if (!selected) throw new Error("Market activity requires at least one product story");
  const product = findProductStory(selected.key);
  const marketplace = MARKETPLACES[index % MARKETPLACES.length] ?? "amazon";
  const kind = KINDS[index % KINDS.length] ?? "crawl_completed";
  const delta = 3 + ((index * 7) % 15);
  const details: Record<MarketEventKind, string> = {
    price_drop: `Price dropped ${delta}% to $${((product.ourPriceCents * (100 - delta)) / 10_000).toFixed(2)}`,
    price_rise: `Price rose ${delta}% to $${((product.ourPriceCents * (100 + delta)) / 10_000).toFixed(2)}`,
    stock_change: index % 2 === 0 ? "Back in stock" : "Stock is running low",
    crawl_completed: `${24 + (index % 73)} offers checked`,
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
  offersPerMinute: number;
  priceChangesToday: number;
  concurrentCrawls: number;
  avgMatchLatencyMs: number;
  throughputHistory: number[];
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
  const throughputHistory = [BASE_OFFERS_PER_MINUTE - 14];
  for (let index = 1; index < HISTORY_LIMIT; index += 1) {
    throughputHistory.push(nextThroughput(throughputHistory[index - 1] ?? 118, index));
  }
  const offersPerMinute = throughputHistory.at(-1) ?? BASE_OFFERS_PER_MINUTE;
  const current = new Date(now);
  const minutesToday = current.getHours() * 60 + current.getMinutes();

  return {
    signalVersion: LIVE_SIGNAL_VERSION,
    timer: null,
    index: HISTORY_LIMIT + SNAPSHOT_LIMIT,
    offersPerMinute,
    priceChangesToday: Math.round((minutesToday * BASE_OFFERS_PER_MINUTE) / 6),
    concurrentCrawls: 4,
    avgMatchLatencyMs: 640,
    throughputHistory,
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
    offersPerMinute: current.offersPerMinute,
    priceChangesToday: current.priceChangesToday,
    concurrentCrawls: current.concurrentCrawls,
    avgMatchLatencyMs: current.avgMatchLatencyMs,
    throughputHistory: current.throughputHistory.slice(-HISTORY_LIMIT),
    events: current.events.slice(0, SNAPSHOT_LIMIT),
  };
}

function advance(current: LiveOperationsState): LiveOperationsSnapshot {
  current.index += 1;
  current.offersPerMinute = nextThroughput(current.offersPerMinute, current.index);
  current.priceChangesToday += 1;
  current.avgMatchLatencyMs = 520 + ((current.index * 37) % 320);
  if (current.index % 3 === 0) current.concurrentCrawls = 3 + ((current.index / 3) % 4);
  current.throughputHistory.push(current.offersPerMinute);
  if (current.throughputHistory.length > HISTORY_LIMIT) current.throughputHistory.shift();
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
