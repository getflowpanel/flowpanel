import type { ColumnFormat, NumericFormat, ResolvedFormatting, StatValue } from "@flowpanel/core";
import { formatColumnValue, formatDateValue, formatNumber } from "@flowpanel/core";
import { columnFormatKind } from "@flowpanel/core/format";
import type { CardDate } from "@flowpanel/react";
import { cardDate } from "./stat-result";

const NUMERIC: ReadonlySet<string> = new Set(["currency", "percent", "bytes", "duration"]);
const MOMENT_KINDS: ReadonlySet<string> = new Set(["date", "relative"]);

type KvFormat = ColumnFormat | NumericFormat | undefined;

const isMoment = (format: KvFormat): boolean =>
  format !== undefined && MOMENT_KINDS.has(columnFormatKind(format as ColumnFormat));

/** A `kv` item's text under a column or numeric format, for places that need a plain string. */
export function kvDisplay(
  value: StatValue,
  format: KvFormat,
  formatting: ResolvedFormatting,
): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date && !isMoment(format)) return formatDateValue(value, formatting);
  if (format === undefined) return String(value);
  if (typeof value === "number" && typeof format === "string" && NUMERIC.has(format)) {
    return formatNumber(value, format as NumericFormat, formatting);
  }
  return formatColumnValue(value, format as ColumnFormat, formatting);
}

/** A `kv` item's value for its card, the same on the dashboard and the drawer. */
export function kvValue(
  value: StatValue,
  format: KvFormat,
  formatting: ResolvedFormatting,
): string | CardDate {
  if (value instanceof Date && !isMoment(format)) return cardDate(value);
  return kvDisplay(value, format, formatting);
}

/** Nothing to show: missing, or only whitespace. */
export function isBlank(value: StatValue): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

/**
 * A long value's head — its first `lines` lines, cut again at a space before `lines × 120`
 * characters — and the rest, if there is any.
 */
export function foldLongText(text: string, lines = 6): { head: string; rest?: string } {
  const keep = Math.max(1, Math.trunc(lines));
  const max = keep * 120;
  let end = text.length;
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "\n") continue;
    seen += 1;
    if (seen === keep) {
      end = i;
      break;
    }
  }
  if (end > max) {
    const space = text.lastIndexOf(" ", max);
    end = space > 0 ? space : max;
  }
  const next = text[end] === "\n" || text[end] === " " ? end + 1 : end;
  const rest = text.slice(next);
  return rest ? { head: text.slice(0, end), rest } : { head: text.slice(0, end) };
}
