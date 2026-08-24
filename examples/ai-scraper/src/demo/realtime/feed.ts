import { publish } from "@flowpanel/kit/next";
import { findProductStory, PRODUCT_STORIES } from "../data/scenarios";
import { MARKETPLACES } from "../data/types";
import {
  MARKET_ACTIVITY_CHANNEL,
  MARKET_ACTIVITY_INTERVAL_MS,
  type MarketActivitySnapshot,
  type MarketEvent,
  type MarketEventKind,
} from "./types";

const BUFFER_LIMIT = 20;
const SNAPSHOT_LIMIT = 5;
const KINDS: readonly MarketEventKind[] = [
  "price_drop",
  "price_rise",
  "stock_change",
  "crawl_completed",
];

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

interface MarketActivityState {
  timer: ReturnType<typeof setInterval> | null;
  index: number;
  offersPerMinute: number;
  activeMonitors: number;
  events: MarketEvent[];
}

const STORE_KEY = Symbol.for("scrapeai.marketActivity");
const globalStore = globalThis as typeof globalThis & { [STORE_KEY]?: MarketActivityState };

function createState(): MarketActivityState {
  const now = Date.now();
  const events = Array.from({ length: SNAPSHOT_LIMIT }, (_, offset) =>
    createMarketEvent(
      SNAPSHOT_LIMIT - offset,
      new Date(now - offset * MARKET_ACTIVITY_INTERVAL_MS),
    ),
  );
  return { timer: null, index: SNAPSHOT_LIMIT, offersPerMinute: 132, activeMonitors: 34, events };
}

function state(): MarketActivityState {
  globalStore[STORE_KEY] ??= createState();
  return globalStore[STORE_KEY];
}

function snapshot(current: MarketActivityState): MarketActivitySnapshot {
  return {
    connected: true,
    offersPerMinute: current.offersPerMinute,
    activeMonitors: current.activeMonitors,
    events: current.events.slice(0, SNAPSHOT_LIMIT),
  };
}

function advance(current: MarketActivityState): MarketActivitySnapshot {
  current.index += 1;
  current.offersPerMinute = 124 + ((current.index * 11) % 27);
  current.activeMonitors = 31 + ((current.index * 5) % 6);
  current.events.unshift(createMarketEvent(current.index, new Date()));
  if (current.events.length > BUFFER_LIMIT) current.events.length = BUFFER_LIMIT;
  return snapshot(current);
}

export function getMarketActivitySnapshot(): MarketActivitySnapshot {
  return snapshot(state());
}

export function startMarketActivityTicker(): void {
  if (process.env.DEMO_LIVE === "off") return;
  const current = state();
  if (current.timer) return;
  current.timer = setInterval(() => {
    void publish(MARKET_ACTIVITY_CHANNEL, advance(current));
  }, MARKET_ACTIVITY_INTERVAL_MS);
}
