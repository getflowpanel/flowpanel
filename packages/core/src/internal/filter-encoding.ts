import { dayKeyIn } from "./day-key";

type Bounds = { gte?: unknown; lte?: unknown };

function encodeBounds({ gte, lte }: Bounds): string | null {
  if (gte === undefined && lte === undefined) return null;
  if (gte instanceof Date || lte instanceof Date) {
    const side = (value: unknown) => (value instanceof Date ? value.toISOString() : "");
    return `${side(gte)}~${side(lte)}`;
  }
  return `${gte === undefined ? "" : String(gte)}:${lte === undefined ? "" : String(lte)}`;
}

/**
 * One filter value as the list's `f_<field>` URL value: a `Date` is its day in `timeZone`, a
 * range of dates `from~to` instants, a range of numbers `min:max`, a set `a,b`. `null` for a
 * value that filters nothing; an object with no URL form throws.
 */
export function encodeFilterValue(value: unknown, timeZone: string): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return dayKeyIn(value, timeZone);
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(String).join(",");
  if (typeof value !== "object") return String(value);
  const shaped = value as Bounds & { op?: unknown; values?: unknown };
  if (shaped.op === "in" && Array.isArray(shaped.values)) {
    return encodeFilterValue(shaped.values, timeZone);
  }
  if (
    shaped.op === "range" ||
    "gte" in shaped ||
    "lte" in shaped ||
    Object.keys(shaped).length === 0
  ) {
    return encodeBounds(shaped);
  }
  throw new Error(
    `flowpanel: a link or view filter value ${JSON.stringify(value)} has no URL form. ` +
      "Pass a value, { gte, lte } or an array.",
  );
}

/** Filters as the list's URL values, keeping only the fields that filter something. */
export function encodeFilters(
  filters: Record<string, unknown> | undefined,
  timeZone: string,
): Record<string, string> {
  const encoded: Record<string, string> = {};
  for (const [field, value] of Object.entries(filters ?? {})) {
    const text = encodeFilterValue(value, timeZone);
    if (text !== null) encoded[field] = text;
  }
  return encoded;
}
