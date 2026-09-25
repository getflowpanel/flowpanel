import { resolvePreset } from "../internal/zone-time";
import type { DateRangePreset } from "../types/dashboard";
import type { WidgetContext } from "../types/widget-context";

/**
 * A preset's range at `now`, in the admin's zone — the bounds the date picker would give it.
 * Pass one `now` when several widgets share a query, so their ranges (and the memo key) match.
 */
export function presetRange(
  preset: DateRangePreset,
  ctx: Pick<WidgetContext, "dateRange">,
  now: Date = new Date(),
): { from: Date; to: Date } {
  return resolvePreset(preset, ctx.dateRange.timeZone, now);
}
