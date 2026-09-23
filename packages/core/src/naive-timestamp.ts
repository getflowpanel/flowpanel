const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * The UTC moment a zoneless `YYYY-MM-DD HH:mm:ss` names — what SQLite and a
 * Postgres `timestamp` return — or `null` for a string of any other shape.
 */
export function parseNaiveTimestamp(value: string): Date | null {
  return NAIVE_TIMESTAMP.test(value) ? new Date(`${value.replace(" ", "T")}Z`) : null;
}
