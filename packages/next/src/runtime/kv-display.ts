import type { ColumnFormat, NumericFormat, ResolvedFormatting, StatValue } from "@flowpanel/core";
import { formatColumnValue, formatDateValue, formatNumber } from "@flowpanel/core";

const NUMERIC: ReadonlySet<string> = new Set(["currency", "percent", "bytes", "duration"]);

/**
 * A `kv` item may name a column format or a numeric one; both resolve to a
 * string here, so the dashboard host and the drawer wire never disagree.
 */
export function kvDisplay(
  value: StatValue,
  format: ColumnFormat | NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return formatDateValue(value, formatting);
  if (format === undefined) return String(value);
  if (typeof format === "string" && NUMERIC.has(format)) {
    return typeof value === "number"
      ? formatNumber(value, format as NumericFormat, formatting)
      : String(value);
  }
  return formatColumnValue(value, format as ColumnFormat, formatting);
}
