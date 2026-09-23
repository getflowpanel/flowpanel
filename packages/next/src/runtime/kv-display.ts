import type { ColumnFormat, NumericFormat, ResolvedFormatting, StatValue } from "@flowpanel/core";
import {
  columnFormatKind,
  formatColumnValue,
  formatDateValue,
  formatNumber,
} from "@flowpanel/core";

const NUMERIC: ReadonlySet<string> = new Set(["currency", "percent", "bytes", "duration"]);
const MOMENT_KINDS: ReadonlySet<string> = new Set(["date", "relative"]);

/** A `kv` item's text under a column or numeric format, the same on the dashboard and the drawer. */
export function kvDisplay(
  value: StatValue,
  format: ColumnFormat | NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  if (value === null || value === undefined) return "—";
  const moment = format !== undefined && MOMENT_KINDS.has(columnFormatKind(format as ColumnFormat));
  if (value instanceof Date && !moment) return formatDateValue(value, formatting);
  if (format === undefined) return String(value);
  if (typeof value === "number" && typeof format === "string" && NUMERIC.has(format)) {
    return formatNumber(value, format as NumericFormat, formatting);
  }
  return formatColumnValue(value, format as ColumnFormat, formatting);
}
