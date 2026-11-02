const NEGATIVE_NUMBER = /^-\d+(?:\.\d+)?$/;

/** One CSV field, quoted as needed, with a leading formula sigil defused by a `'`; a negative number stays a number. */
export function csvField(value: string): string {
  const formula = /^[=+\-@\t\r]/.test(value) && !NEGATIVE_NUMBER.test(value);
  const safe = formula ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A cell's text: empty for nothing, ISO for a date, JSON for an object. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** One CSV line of `values`, without its `\r\n`. */
export function csvLine(values: readonly unknown[]): string {
  return values.map((value) => csvField(cellText(value))).join(",");
}
