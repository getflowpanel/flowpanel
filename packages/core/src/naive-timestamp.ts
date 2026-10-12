const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/** The UTC moment a zoneless `YYYY-MM-DD HH:mm:ss` names, or `null` for any other shape. */
export function parseNaiveTimestamp(value: string): Date | null {
  return NAIVE_TIMESTAMP.test(value) ? new Date(`${value.replace(" ", "T")}Z`) : null;
}
