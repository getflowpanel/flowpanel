import { dayKeyIn } from "./day-key";

type Bounds = { gte?: unknown; lte?: unknown };

function shown(bound: unknown, factor: number): string {
  if (bound === undefined) return "";
  const numeric =
    typeof bound === "number" || typeof bound === "bigint" || typeof bound === "string";
  const n = numeric && String(bound).trim() !== "" ? Number(bound) : Number.NaN;
  if (factor === 1 || !Number.isFinite(n)) return String(bound);
  return String(Number((n / factor).toPrecision(15)));
}

function encodeBounds({ gte, lte }: Bounds, factor: number): string | null {
  if (gte === undefined && lte === undefined) return null;
  if (gte instanceof Date || lte instanceof Date) {
    const side = (value: unknown) => (value instanceof Date ? value.toISOString() : "");
    return `${side(gte)}~${side(lte)}`;
  }
  return `${shown(gte, factor)}:${shown(lte, factor)}`;
}

/** One filter value as its `f_<field>` URL value, money bounds divided by `factor`; `null` filters nothing. */
export function encodeFilterValue(value: unknown, timeZone: string, factor = 1): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return dayKeyIn(value, timeZone);
  if (Array.isArray(value)) return value.length === 0 ? null : value.map(String).join(",");
  if (typeof value !== "object") return String(value);
  const shaped = value as Bounds & { op?: unknown; values?: unknown };
  if (shaped.op === "in" && Array.isArray(shaped.values)) {
    return encodeFilterValue(shaped.values, timeZone, factor);
  }
  if (
    shaped.op === "range" ||
    "gte" in shaped ||
    "lte" in shaped ||
    Object.keys(shaped).length === 0
  ) {
    return encodeBounds(shaped, factor);
  }
  throw new Error(
    `flowpanel: a link or view filter value ${JSON.stringify(value)} has no URL form. ` +
      "Pass a value, { gte, lte } or an array.",
  );
}

/** Filters as the list's URL values: `null` turns a filter and its default off, `undefined` is left out. */
export function encodeFilters(
  filters: Record<string, unknown> | undefined,
  timeZone: string,
  moneyFactors: ReadonlyMap<string, number> = new Map(),
): Record<string, string> {
  const encoded: Record<string, string> = {};
  for (const [field, value] of Object.entries(filters ?? {})) {
    const text =
      value === null ? "" : encodeFilterValue(value, timeZone, moneyFactors.get(field) ?? 1);
    if (text !== null) encoded[field] = text;
  }
  return encoded;
}
