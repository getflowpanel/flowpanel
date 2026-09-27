import type { RangeLimit, WidgetConfig, WidgetContext } from "@flowpanel/core";
import { rangedContext, requestNow } from "./widget-context";
import { warnOnce } from "./widget-reads";

const DAY_MS = 86_400_000;

/** What a widget with `maxRange` may query: nothing when expired, else its context and any cut. */
export type RetainedRange =
  | { expired: true; ctx: WidgetContext; days: number }
  | { expired: false; ctx: WidgetContext; keptSince: Date | null };

function capDays(limit: string | undefined): number | null {
  if (limit === undefined) return null;
  const match = /^(\d+)d$/.exec(limit);
  const days = Number(match?.[1]);
  if (match && days > 0) return days;
  warnOnce(
    `maxRange:${limit}`,
    `maxRange "${limit}" is not a whole number of days such as "30d"; the widget queries the full range.`,
  );
  return null;
}

/**
 * The range a widget with `maxRange: "Nd"` queries: capped at `max(from, to − N, now − N)`,
 * "now" fixed per request. A range that ends at or before `now − N` is expired.
 */
export function retainedRange(widget: WidgetConfig, ctx: WidgetContext): RetainedRange {
  const days = capDays((widget.options as { maxRange?: RangeLimit }).maxRange);
  if (days === null) return { expired: false, ctx, keptSince: null };
  const horizon = requestNow(ctx) - days * DAY_MS;
  const { from, to } = ctx.dateRange;
  if (to.getTime() <= horizon) return { expired: true, ctx, days };
  const earliest = Math.max(to.getTime() - days * DAY_MS, horizon);
  if (from.getTime() >= earliest) {
    return { expired: false, ctx: rangedContext(ctx, ctx.dateRange, days), keptSince: null };
  }
  const cut = new Date(earliest);
  return {
    expired: false,
    ctx: rangedContext(ctx, { from: cut, to, preset: "custom" }, days),
    keptSince: cut,
  };
}
