import type { WidgetConfig, WidgetContext } from "@flowpanel/core";
import type { ReactNode } from "react";
import { rangedContext, requestNow } from "./widget-context";

const DAY_MS = 86_400_000;
const warned = new Set<string>();

/** What a widget with `maxRange` may query: nothing once its range has expired. */
export type RetainedRange =
  | { expired: true; ctx: WidgetContext; days: number }
  | { expired: false; ctx: WidgetContext };

function capDays(limit: string | undefined): number | null {
  if (limit === undefined) return null;
  const match = /^(\d+)d$/.exec(limit);
  const days = Number(match?.[1]);
  if (match && days > 0) return days;
  if (process.env.NODE_ENV !== "production" && !warned.has(limit)) {
    warned.add(limit);
    console.warn(
      `[flowpanel] maxRange "${limit}" is not a whole number of days such as "30d"; ` +
        "the widget queries the full range.",
    );
  }
  return null;
}

/**
 * The range a widget with `maxRange: "Nd"` queries: capped at `max(from, to − N, now − N)`,
 * "now" fixed per request. A range that ends at or before `now − N` is expired.
 */
export function retainedRange(widget: WidgetConfig, ctx: WidgetContext): RetainedRange {
  const days = capDays(widget.options.maxRange);
  if (days === null) return { expired: false, ctx };
  const horizon = requestNow(ctx) - days * DAY_MS;
  const { from, to } = ctx.dateRange;
  if (to.getTime() <= horizon) return { expired: true, ctx, days };
  const earliest = Math.max(to.getTime() - days * DAY_MS, horizon);
  const range =
    from.getTime() >= earliest
      ? ctx.dateRange
      : { from: new Date(earliest), to, preset: "custom" as const };
  return { expired: false, ctx: rangedContext(ctx, range, days) };
}

/** The context a widget with `maxRange` queries with: its last N days, compared only within them. */
export function maxRangeContext(widget: WidgetConfig, ctx: WidgetContext): WidgetContext {
  return retainedRange(widget, ctx).ctx;
}

/** What an expired widget shows instead of querying: its title and its empty state. */
export function expiredCard(
  widget: WidgetConfig,
  ctx: WidgetContext,
): { label?: string; emptyState: ReactNode } {
  const label = "label" in widget ? widget.label : (widget.options as { label?: string }).label;
  const own = (widget.options as { emptyState?: ReactNode }).emptyState;
  return { ...(label ? { label } : {}), emptyState: own ?? ctx.labels.widget.empty };
}
