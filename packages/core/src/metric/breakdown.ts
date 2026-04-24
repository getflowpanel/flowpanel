/**
 * breakdown() — loader for "value by dimension" charts (bar/pie).
 *
 * User's compute returns one ChartBucket per dimension value. This helper
 * optionally resolves a time range, forwards `limit`, and — when asked —
 * sorts the result in-memory. Sorting lives here (not in SQL) so adapters
 * don't have to care about ORDER BY shape.
 */

import type { ChartBucket } from "../widget/types";
import { parseRange } from "./range";
import type { MetricCtx, MetricRange } from "./types";

export interface BreakdownParams {
  readonly range?: MetricRange;
  readonly limit?: number;
}

export interface BreakdownOptions<TCtx extends MetricCtx> {
  compute: (ctx: TCtx, params: BreakdownParams) => Promise<ChartBucket[]> | ChartBucket[];
  /** Default range when `ctx.range` is absent. Omit to skip range entirely. */
  defaultRange?: string;
  /** Forwarded to compute; helpers also truncate post-sort. */
  limit?: number;
  /** Post-sort. Default: preserve compute's order. */
  sort?: "value-desc" | "value-asc" | "label-asc";
  now?: () => Date;
}

export function breakdown<TCtx extends MetricCtx = MetricCtx>(
  opts: BreakdownOptions<TCtx>,
): (ctx: unknown) => Promise<ChartBucket[]> {
  const { compute, defaultRange, limit, sort, now = () => new Date() } = opts;

  return async (rawCtx: unknown): Promise<ChartBucket[]> => {
    const ctx = rawCtx as TCtx;
    const range: MetricRange | undefined =
      ctx.range ?? (defaultRange ? parseRange(defaultRange, now()) : undefined);
    let rows = await compute(ctx, { range, limit });

    if (sort === "value-desc") rows = [...rows].sort((a, b) => b.value - a.value);
    else if (sort === "value-asc") rows = [...rows].sort((a, b) => a.value - b.value);
    else if (sort === "label-asc") rows = [...rows].sort((a, b) => a.label.localeCompare(b.label));

    if (limit != null && rows.length > limit) rows = rows.slice(0, limit);
    return rows;
  };
}
