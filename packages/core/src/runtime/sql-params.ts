const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

function sanitizeSqlParam(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(sanitizeSqlParam);
  return value;
}

/**
 * Coerce `ctx.sql` values to what every driver can bind: a `Date` to ISO-8601
 * text and a `bigint` to decimal text, and the same one level into an array's
 * own values — how an array itself binds is the adapter's business. Call this
 * from an adapter's `sql` so the same template behaves the same on Postgres,
 * MySQL and SQLite.
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
 * Normalise `ctx.sql` result rows. A free-form statement carries no column
 * types to consult, so every string shaped exactly like a zoneless
 * `YYYY-MM-DD HH:mm:ss` timestamp becomes a UTC `Date` — which is what the
 * drivers that return them mean. Cast a text column in the query to keep it a
 * string, or turn the whole pass off with `parseDates: false`.
 */
export function parseSqlRows<Row>(
  rows: ReadonlyArray<Record<string, unknown>>,
  options: ParseSqlRowsOptions = {},
): Row[] {
  if (options.parseDates === false) return rows as unknown as Row[];
  return rows.map((row) => {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      parsed[key] =
        typeof value === "string" && NAIVE_TIMESTAMP.test(value)
          ? new Date(`${value.replace(" ", "T")}Z`)
          : value;
    }
    return parsed as Row;
  });
}
