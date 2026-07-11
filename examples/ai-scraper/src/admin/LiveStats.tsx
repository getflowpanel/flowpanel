"use client";
import { AreaChart } from "@flowpanel/kit/charts/runtime";
import { useLiveChannel } from "@flowpanel/kit/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_CHANNEL,
  type LivePayload,
  type LiveStats as LiveStatsT,
  TICK_MS,
} from "@/src/lib/live-types";
import { LiveDot } from "./LiveDot";

const nf = new Intl.NumberFormat("en-US");
const CHART_OPTIONS = { x: "time", y: "rate", smooth: true, height: 120 } as const;

/** Ease a displayed number toward a target with requestAnimationFrame. */
function useTween(target: number, ms = 700): number {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  valRef.current = val;
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(target);
      return;
    }
    const from = valRef.current;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, ms]);

  return val;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <div className="text-xs text-fp-text-3">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-fp-text-1">{value}</div>
    </div>
  );
}

/**
 * Live throughput counters fed by the `live` channel. Numbers tween on each
 * tick; the crawl-rate trend uses FlowPanel's native area chart (axes, grid,
 * tooltip/hover and theming all built in) instead of a hand-rolled SVG.
 * Initial values are server-rendered so nothing flashes empty.
 */
export function LiveStats({ initial }: { initial: LiveStatsT }) {
  const [stats, setStats] = useState<LiveStatsT>(initial);
  const status = useLiveChannel(LIVE_CHANNEL, (payload) => {
    const p = payload as LivePayload | undefined;
    if (p?.stats) setStats(p.stats);
  });
  const live = status === "live";

  const listings = useTween(stats.listingsPerMin);
  const changes = useTween(stats.priceChangesToday);
  const crawls = useTween(stats.activeCrawls);
  const latency = stats.avgMatchLatencyMs;

  // Shape the in-memory series for the native chart. Samples are ~TICK_MS
  // apart; label each with a wall-clock time so the x-axis and tooltip read
  // naturally (a plain "HH:MM:SS" string, not a date, so it passes through
  // the tick formatter as-is). Memoized on `history` so the three per-frame
  // counter tweens below don't rebuild the series or re-render the chart.
  const chartData = useMemo(() => {
    const n = stats.history.length;
    const pad = (x: number) => String(x).padStart(2, "0");
    return stats.history.map((rate, i) => {
      const d = new Date(Date.now() - (n - 1 - i) * TICK_MS);
      return { time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, rate };
    });
  }, [stats.history]);

  // Memoize the chart element itself so the tween-driven re-renders skip the
  // whole recharts subtree (its props are otherwise stable).
  const chart = useMemo(() => <AreaChart data={chartData} options={CHART_OPTIONS} />, [chartData]);

  return (
    <div className="overflow-hidden rounded-fp border border-fp-border-1 bg-fp-bg-1">
      <div className="flex items-center justify-between border-b border-fp-border-1 px-4 py-3">
        <h3 className="text-sm font-semibold text-fp-text-1">Throughput</h3>
        <LiveDot live={live} />
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-fp-border-1 sm:grid-cols-4 sm:divide-y-0">
        <Stat label="Listings / min" value={nf.format(listings)} />
        <Stat label="Price changes today" value={nf.format(changes)} />
        <Stat label="Concurrent crawls" value={nf.format(crawls)} />
        <Stat label="Avg match latency" value={`${(latency / 1000).toFixed(1)} s`} />
      </div>
      <div className="border-t border-fp-border-1 px-2 pb-2 pt-3">
        <div className="mb-1 px-2 text-xs text-fp-text-3">Crawl rate · listings / min</div>
        {chart}
      </div>
    </div>
  );
}
