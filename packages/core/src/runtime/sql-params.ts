import { parseNaiveTimestamp } from "../naive-timestamp";

function sanitizeSqlParam(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeSqlParam);
  return value;
}

/**
 * Coerces `ctx.sql` values to what every driver can bind: a `Date` to ISO-8601 text, a `bigint` to decimal text.
 * Call this from an adapter's `sql` so the same template behaves the same on Postgres, MySQL and SQLite.
 */
export function sanitizeSqlParams(values: readonly unknown[]): unknown[] {
  return values.map(sanitizeSqlParam);
}

export interface ParseSqlRowsOptions {
  /** `false` hands every value through exactly as the driver returned it.
   * @defaultValue true
   */
  parseDates?: boolean;
}

/**
 * Normalises `ctx.sql` result rows: every string shaped like a zoneless `YYYY-MM-DD HH:mm:ss` timestamp becomes a UTC `Date`.
 * Cast a text column in the query to keep it a string, or turn the whole pass off with `parseDates: false`.
 */
export function parseSqlRows<Row>(
  rows: ReadonlyArray<Record<string, unknown>>,
  options: ParseSqlRowsOptions = {},
): Row[] {
  if (options.parseDates === false) return rows as unknown as Row[];
  return rows.map((row) => {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      parsed[key] = typeof value === "string" ? (parseNaiveTimestamp(value) ?? value) : value;
    }
    return parsed as Row;
  });
}
