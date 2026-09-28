import { isCalendarDayString } from "./internal/zone-time";
import { parseNaiveTimestamp } from "./naive-timestamp";
import { toneFor } from "./tone-for";
import { DEFAULT_FORMATTING, type ResolvedFormatting } from "./types/formatting";
import type { ColumnFormat } from "./types/resource";
import type { Tone } from "./types/widget";

/** The kind of a {@link ColumnFormat}, written as a string or as an object. */
export type ColumnFormatKind =
  | Extract<ColumnFormat, string>
  | Extract<ColumnFormat, object>["kind"];

export function columnFormatKind(format: ColumnFormat): ColumnFormatKind {
  return typeof format === "string" ? format : format.kind;
}

const ZONED_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(?:(Z)|([+-]\d{2}):?(\d{2})?)$/i;

function parseIsoMoment(value: string): Date | null {
  if (isCalendarDay(value)) return new Date(value);
  const naive = parseNaiveTimestamp(value);
  if (naive) return naive;
  const zoned = ZONED_TIMESTAMP.exec(value);
  if (!zoned) return null;
  const [, day, clock, utc, hours, minutes = "00"] = zoned;
  return new Date(`${day}T${clock}${utc ? "Z" : `${hours}:${minutes}`}`);
}

function momentOf(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return typeof value === "string" ? parseIsoMoment(value) : null;
}

/**
 * A moment from a `Date`, epoch milliseconds or an ISO string, where a zoneless
 * timestamp is UTC as in `parseSqlRows`; `null` for any other value.
 */
export function toDateValue(value: unknown): Date | null {
  const date = momentOf(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** A `YYYY-MM-DD` string: a calendar day, which belongs to no zone. */
export function isCalendarDay(value: unknown): value is string {
  return isCalendarDayString(value);
}

const UNIT_FMTS = new Map<string, Intl.NumberFormat>();

function unitFmt(
  locale: string,
  unit: string,
  digits: number,
  unitDisplay: "short" | "narrow" = "short",
): Intl.NumberFormat {
  const key = `${locale}|${unit}|${digits}|${unitDisplay}`;
  let fmt = UNIT_FMTS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay,
      maximumFractionDigits: digits,
    });
    UNIT_FMTS.set(key, fmt);
  }
  return fmt;
}

function joinUnits(locale: string, parts: ReadonlyArray<readonly [string, number]>): string {
  return parts
    .filter(([, amount]) => amount > 0)
    .map(([unit, amount]) => unitFmt(locale, unit, 0).format(amount))
    .join(" ");
}

/** Milliseconds as the largest units that fit, in the admin's locale — `4.2 sec`, `2 hr 5 min`. */
export function formatDurationValue(
  ms: number,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (!Number.isFinite(ms)) return String(ms);
  const abs = Math.abs(ms);
  const { locale } = formatting;
  const millis = Math.round(abs);
  const sign = ms < 0 && millis > 0 ? "-" : "";
  if (millis < 1000) return sign + unitFmt(locale, "millisecond", 0).format(millis);
  const tenths = Math.round(abs / 100);
  if (tenths < 100) return sign + unitFmt(locale, "second", 1).format(tenths / 10);
  const seconds = Math.round(abs / 1000);
  if (seconds < 60) return sign + unitFmt(locale, "second", 0).format(seconds);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return sign + unitFmt(locale, "minute", 0).format(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return (
      sign +
      joinUnits(locale, [
        ["hour", hours],
        ["minute", minutes % 60],
      ])
    );
  }
  return (
    sign +
    joinUnits(locale, [
      ["day", Math.floor(hours / 24)],
      ["hour", hours % 24],
    ])
  );
}

/**
 * The largest of `units`, listed largest first, that `abs` reaches once rounded
 * at the precision of the unit below it, so 59.6 minutes is an hour.
 */
function unitFor<Unit extends string>(
  units: ReadonlyArray<readonly [Unit, number]>,
  abs: number,
  round: (amount: number) => number,
): readonly [Unit, number] | undefined {
  return units.find(([, size], at) => {
    const below = units[at + 1];
    return abs >= size || (below !== undefined && round(abs / below[1]) * below[1] >= size);
  });
}

const COMPACT_UNITS: ReadonlyArray<readonly [string, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
  ["millisecond", 1],
];

const toTenths = (amount: number) => Math.round(amount * 10) / 10;

/** Milliseconds in the largest unit that fits, one decimal at most — `2.1h`, `42s` — for an axis. */
export function formatDurationCompact(
  ms: number,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (!Number.isFinite(ms)) return String(ms);
  const [unit, size] = unitFor(COMPACT_UNITS, Math.abs(ms), toTenths) ?? ["millisecond", 1];
  return unitFmt(formatting.locale, unit, 1, "narrow").format(ms / size);
}

const PERCENT_FMTS = new Map<string, Intl.NumberFormat>();

/**
 * A fraction as a percentage — `0.423` → `42.3%` — with at most `digits`
 * decimals, a whole number from 0 to 20.
 */
export function formatPercentValue(
  value: number,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
  digits = 1,
): string {
  if (!Number.isFinite(value)) return String(value);
  const places = Number.isFinite(digits) ? Math.min(20, Math.max(0, Math.trunc(digits))) : 1;
  const key = `${formatting.locale}|${places}`;
  let fmt = PERCENT_FMTS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(formatting.locale, {
      style: "percent",
      maximumFractionDigits: places,
    });
    PERCENT_FMTS.set(key, fmt);
  }
  return fmt.format(value);
}

const RELATIVE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];
const RELATIVE_FMTS = new Map<string, Intl.RelativeTimeFormat>();

/** How long ago, or how far ahead, a moment is — `5 minutes ago`, `yesterday`. */
export function formatRelativeValue(
  value: Date | string | number,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
  now: Date = new Date(),
): string {
  const date = toDateValue(value);
  if (date === null) return String(value);
  const diff = date.getTime() - now.getTime();
  const [unit, size] = unitFor(RELATIVE_UNITS, Math.abs(diff), Math.round) ?? ["second", 1000];
  let fmt = RELATIVE_FMTS.get(formatting.locale);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(formatting.locale, { numeric: "auto" });
    RELATIVE_FMTS.set(formatting.locale, fmt);
  }
  return fmt.format(Math.round(diff / size), unit);
}

/** A boolean, `"true"`/`"false"` or SQLite's `1`/`0` as a boolean; `null` for any other value. */
export function toBooleanValue(value: unknown): boolean | null {
  if (value === true || value === "true" || value === 1) return true;
  if (value === false || value === "false" || value === 0) return false;
  return null;
}

/** A boolean cell: `✓` and `✕` unless the format names its own words; SQLite's `1` and `0` count. */
export function formatBooleanValue(value: unknown, format: ColumnFormat): string {
  const labels =
    typeof format === "object" && format.kind === "boolean" ? format.labels : undefined;
  const flag = toBooleanValue(value);
  if (flag === null) return String(value);
  return flag ? (labels?.true ?? "✓") : (labels?.false ?? "✕");
}

/** The shade step, 0 to 5, of a `{ kind: "percent", heat: true }` cell; `null` for any other cell. */
export function percentHeatLevel(value: unknown, format: ColumnFormat): number | null {
  if (typeof format !== "object" || format.kind !== "percent" || !format.heat) return null;
  const n =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || value === "") return null;
  return Math.round(Math.min(1, Math.max(0, n)) * 5);
}

/** The tone a numeric column format's `tones` gives a cell; `null` when the format has none. */
export function cellTone(value: unknown, format: ColumnFormat): Tone | null {
  if (typeof format !== "object") return null;
  const tones =
    format.kind === "number" || format.kind === "percent" || format.kind === "duration"
      ? format.tones
      : undefined;
  if (!tones) return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return toneFor(Number.isFinite(n) ? n : null, tones);
}

/** The link a `url` cell renders: only `http(s)` and same-site paths, never `javascript:` or `//`. */
export function urlCellParts(
  value: unknown,
  format: ColumnFormat,
): { href: string; text: string } | null {
  if (columnFormatKind(format) !== "url" || typeof value !== "string") return null;
  const label = typeof format === "object" && format.kind === "url" ? format.label : undefined;
  if (value.startsWith("/")) {
    const offSite = /^\/[/\\]/.test(value.replace(/[\t\n\r]/g, ""));
    return offSite ? null : { href: value, text: label ?? value };
  }
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return { href: value, text: label ?? `${url.host}${url.pathname === "/" ? "" : url.pathname}` };
  } catch {
    return null;
  }
}
