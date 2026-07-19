/**
 * Liveness as an ephemeral layer over durable data: one server-side ticker
 * publishes to the `live` SSE channel every ~2s and never writes to Postgres.
 */
import { publish } from "@flowpanel/kit/next";
import { CATALOG, SITES } from "./catalog";
import {
  type FeedEvent,
  LIVE_CHANNEL,
  type LivePayload,
  type LiveStats,
  TICK_MS,
} from "./live-types";

export type { FeedEvent, LivePayload, LiveStats } from "./live-types";

const FEED_CAP = 18;
const SPARK_CAP = 36;
const BASE_LISTINGS_PER_MIN = 130; // platform-wide crawl rate the walk hovers around

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Mean-reverting walk: pull `prev` a quarter of the way toward `center`, then
 * add small deterministic noise. Hovers naturally around the centre instead of
 * wandering the whole range like a plain random walk.
 */
function drift(
  prev: number,
  center: number,
  seqSeed: number,
  noise: number,
  min: number,
  max: number,
): number {
  const n = (seqSeed % (2 * noise + 1)) - noise;
  return clamp(Math.round(prev + (center - prev) * 0.25 + n), min, max);
}

interface LiveState {
  timer: ReturnType<typeof setInterval> | null;
  seq: number;
  events: FeedEvent[];
  history: number[];
  priceChangesToday: number;
  listingsPerMin: number;
  activeCrawls: number;
  avgMatchLatencyMs: number;
  dayKey: string;
}

const STORE_KEY = Symbol.for("scrapeai.liveFeed");
const g = globalThis as typeof globalThis & { [STORE_KEY]?: LiveState };

const dayKeyNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
const minutesSinceMidnight = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
// Price changes already detected "today" — roughly one per ~6 listings
// crawled, so the counter and the crawl rate tell a consistent story.
const basePriceChangesToday = () =>
  Math.round((minutesSinceMidnight() * BASE_LISTINGS_PER_MIN) / 6);

/** Build one price-change event from the catalog. */
function makeEvent(seq: number, at: number): FeedEvent {
  const p = CATALOG[seq % CATALOG.length];
  if (!p) throw new Error("live-feed: empty catalog");
  const site = SITES[seq % SITES.length] ?? "amazon";
  // Deterministic signed delta, drops a bit more common than rises.
  const raw = ((seq * 13) % 28) - 18; // -18..+9
  const pct = raw === 0 ? -3 : raw;
  const oldPriceCents = p.priceCents;
  const newPriceCents = Math.max(100, Math.round(oldPriceCents * (1 + pct / 100)));
  const stock =
    (["in_stock", "in_stock", "low_stock", "out_of_stock"] as const)[seq % 4] ?? "in_stock";
  return {
    id: seq,
    site,
    title: p.title,
    oldPriceCents,
    newPriceCents,
    pctDelta: pct,
    direction: pct < 0 ? "drop" : "rise",
    stock,
    at,
  };
}

/** Advance the simulation by one step (mutates `state`). */
function advance(state: LiveState, at: number): void {
  state.seq += 1;
  const event = makeEvent(state.seq, at);
  state.events.unshift(event);
  if (state.events.length > FEED_CAP) state.events.pop();

  if (dayKeyNow() !== state.dayKey) {
    state.dayKey = dayKeyNow();
    state.priceChangesToday = basePriceChangesToday();
  }

  // Crawl throughput hovers around a centre that slowly rolls.
  const center = BASE_LISTINGS_PER_MIN + Math.round(28 * Math.sin(state.seq / 16));
  state.listingsPerMin = drift(state.listingsPerMin, center, state.seq * 37, 5, 70, 210);
  // One detected price change per tick.
  state.priceChangesToday += 1;
  // AI match latency tracks its own gentle curve.
  const latCenter = 900 + Math.round(260 * Math.sin(state.seq / 23 + 1));
  state.avgMatchLatencyMs = drift(
    state.avgMatchLatencyMs,
    latCenter,
    state.seq * 53,
    50,
    400,
    1800,
  );
  // Active crawls drift slowly — they shouldn't flip every tick.
  if (state.seq % 4 === 0) {
    state.activeCrawls = drift(
      state.activeCrawls,
      2 + ((state.seq >> 2) % 5),
      state.seq * 13,
      1,
      2,
      7,
    );
  }

  state.history.push(state.listingsPerMin);
  if (state.history.length > SPARK_CAP) state.history.shift();
}

function snapshot(state: LiveState): LiveStats {
  return {
    listingsPerMin: state.listingsPerMin,
    priceChangesToday: state.priceChangesToday,
    activeCrawls: state.activeCrawls,
    avgMatchLatencyMs: state.avgMatchLatencyMs,
    history: [...state.history],
  };
}

function createState(): LiveState {
  const state: LiveState = {
    timer: null,
    seq: 0,
    events: [],
    history: [],
    priceChangesToday: basePriceChangesToday(),
    listingsPerMin: BASE_LISTINGS_PER_MIN,
    activeCrawls: 4,
    avgMatchLatencyMs: 950,
    dayKey: dayKeyNow(),
  };
  // Prime a full sparkline's worth of history (and the feed) so both render
  // populated on first paint, then go live.
  const now = Date.now();
  for (let k = SPARK_CAP; k >= 1; k--) advance(state, now - k * TICK_MS);
  return state;
}

/**
 * Start the ticker once per process. Safe to call repeatedly.
 *
 * We don't bind the publisher here — the SSE stream route binds it to the
 * config's realtime driver on every connection, and `publish()` always reads
 * the current process-global publisher, so the ticker stays in sync. (This
 * also keeps `live-feed` free of a config import, avoiding a cycle.)
 */
export function startLiveFeed(): void {
  const state = ensureState();
  if (state.timer) return;
  state.timer = setInterval(() => {
    advance(state, Date.now());
    const payload: LivePayload = {
      recent: state.events,
      stats: snapshot(state),
    };
    void publish(LIVE_CHANNEL, payload);
  }, TICK_MS);
}

/** Get-or-create the simulation in the module store, so the ticker and the
 *  server-render getters below share one persistent state — a pre-ticker
 *  getter call primes the store instead of building a throwaway sim. */
function ensureState(): LiveState {
  const state = g[STORE_KEY] ?? createState();
  g[STORE_KEY] = state;
  return state;
}

/** Current feed events (newest first) — for server-rendered initial props. */
export function getRecentEvents(): FeedEvent[] {
  return ensureState().events;
}

/** Current throughput stats — for server-rendered initial props. */
export function getLiveStats(): LiveStats {
  return snapshot(ensureState());
}
