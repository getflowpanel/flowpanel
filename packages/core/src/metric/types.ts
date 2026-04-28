/**
 * Public metric helper types — shared across metric/timeseries/breakdown.
 *
 * This layer is ORM-agnostic: the user provides a `compute` callback that
 * runs whatever query they like against `ctx.db`; the helpers only
 * orchestrate time-range resolution and trend math.
 */

import type { MetricTrend as WidgetMetricTrend } from "../widget/types";

export type MetricTrend = WidgetMetricTrend;

export interface MetricRange {
  readonly start: Date;
  readonly end: Date;
}

export type MetricBucket = "hour" | "day" | "week" | "month";

/**
 * Context received by every helper. `db` is `unknown` because core doesn't
 * depend on any ORM — the user casts it inside `compute`. `range` is optional
 * so widgets without a time-range picker still work (helpers fall back to
 * `defaultRange`).
 */
export interface MetricCtx {
  readonly db: import("../types/augmentation").FpDb;
  readonly range?: MetricRange;
  readonly session?: import("../types/augmentation").FpSession;
}
