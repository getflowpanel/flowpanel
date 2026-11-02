import type { StatResult, StatValue } from "@flowpanel/core";
import type { CardDate } from "@flowpanel/react";

/** A `Date` is an object and a legal stat value, so the result shape is checked by its own field. */
export function isStatResult(value: StatValue | StatResult): value is StatResult {
  return (
    typeof value === "object" && value !== null && !(value instanceof Date) && "value" in value
  );
}

/** Every `stat()` value, bare or result object, as one shape the renderers can read. */
export function statResultOf(produced: StatValue | StatResult): StatResult {
  return isStatResult(produced) ? produced : { value: produced };
}

/** A `Date` as the instant a card renders through `LocalTime`, the way a datetime column does. */
export function cardDate(value: Date): CardDate | string {
  return Number.isNaN(value.getTime()) ? "—" : { kind: "date", iso: value.toISOString() };
}

/** What a stat card shows for a resolved value. */
export function statDisplay(value: StatValue): string | number | CardDate {
  if (value instanceof Date) return cardDate(value);
  return typeof value === "number" ? value : String(value ?? "—");
}
