/**
 * metric() — a scalar metric with optional vs-previous-period trend.
 *
 * Why this exists: when a dashboard shows a "+18% vs last month" delta, the
 * user otherwise writes the same query twice — once for the current range,
 * once for the previous. This helper runs `compute` against both windows and
 * computes the trend math for you.
 *
 * ORM-agnostic: `compute` receives the raw context (with `db: unknown`) and
 * the resolved range. The user casts `db` to their Drizzle/Prisma client.
 */

import { parseRange, previousRange } from "./range";
import type { MetricCtx, MetricRange, MetricTrend } from "./types";

export interface MetricOptions<TCtx extends MetricCtx> {
  /** Async callback executed against a specific time range. Returns the scalar. */
  compute: (ctx: TCtx, range: MetricRange) => Promise<number | null> | number | null;
  /** Default range when `ctx.range` is absent. Format: `<number><h|d|w|M>`. */
  defaultRange?: string;
  /** Opt-in auto-computed trend against the previous period of equal duration. */
  trend?: "vs-previous-period";
  /** Injected clock for tests; production callers should not override. */
  now?: () => Date;
}

export interface MetricHandle {
  value: (ctx: unknown) => Promise<number | null>;
  trend?: (ctx: unknown) => Promise<MetricTrend | null>;
}

export function metric<TCtx extends MetricCtx = MetricCtx>(
  opts: MetricOptions<TCtx>,
): MetricHandle {
  const { compute, defaultRange = "30d", trend, now = () => new Date() } = opts;

  const resolveRange = (ctx: TCtx): MetricRange => ctx.range ?? parseRange(defaultRange, now());

  const value = async (rawCtx: unknown): Promise<number | null> => {
    const ctx = rawCtx as TCtx;
    const range = resolveRange(ctx);
    return await compute(ctx, range);
  };

  if (trend !== "vs-previous-period") return { value };

  const trendFn = async (rawCtx: unknown): Promise<MetricTrend | null> => {
    const ctxT = rawCtx as TCtx;
    const range = resolveRange(ctxT);
    const prev = previousRange(range);
    const [curr, prevVal] = await Promise.all([compute(ctxT, range), compute(ctxT, prev)]);
    if (curr == null || prevVal == null) return null;
    const delta = curr - prevVal;
    const deltaPercent = prevVal === 0 ? (curr === 0 ? 0 : 100) : (delta / prevVal) * 100;
    const direction: MetricTrend["direction"] = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
    return {
      delta,
      deltaPercent: round2(deltaPercent),
      direction,
      period: `vs previous ${defaultRange}`,
    };
  };

  return { value, trend: trendFn };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
