/**
 * timeseries() — loader that produces ChartBucket[] for a time window.
 *
 * The user's compute callback receives { start, end, bucket } and is
 * expected to emit one ChartBucket per time bucket (already formatted for
 * display). This helper only orchestrates range + default bucket resolution.
 */

import type { ChartBucket } from "../widget/types";
import { defaultBucketFor, parseRange } from "./range";
import type { MetricBucket, MetricCtx, MetricRange } from "./types";

export interface TimeseriesParams {
  readonly start: Date;
  readonly end: Date;
  readonly bucket: MetricBucket;
}

export interface TimeseriesOptions<TCtx extends MetricCtx> {
  compute: (ctx: TCtx, params: TimeseriesParams) => Promise<ChartBucket[]> | ChartBucket[];
  /** Default range when ctx.range is absent. Format: `<number><h|d|w|M>`. */
  defaultRange?: string;
  /** Explicit bucket; otherwise derived from the range length via defaultBucketFor. */
  defaultBucket?: MetricBucket;
  /** Injected clock for tests. */
  now?: () => Date;
}

export function timeseries<TCtx extends MetricCtx = MetricCtx>(
  opts: TimeseriesOptions<TCtx>,
): (ctx: unknown) => Promise<ChartBucket[]> {
  const { compute, defaultRange = "30d", defaultBucket, now = () => new Date() } = opts;

  return async (rawCtx: unknown): Promise<ChartBucket[]> => {
    const ctx = rawCtx as TCtx;
    const range: MetricRange = ctx.range ?? parseRange(defaultRange, now());
    const bucket = defaultBucket ?? defaultBucketFor(range);
    const result = await compute(ctx, { start: range.start, end: range.end, bucket });
    return result;
  };
}
