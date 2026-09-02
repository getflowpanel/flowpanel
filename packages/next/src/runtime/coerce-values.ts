import type { ColumnMeta } from "@flowpanel/core";

export interface CoerceRowResult {
  /** The row with column-typed values swapped in for coercible string cells. */
  values: Record<string, unknown>;
  /** Per-field messages for cells that could not be coerced to their column's type. */
  fieldErrors: Record<string, string>;
}

/** Coerce a raw row's string cells to the JS type its column expects, ahead of Zod validation. */
export function coerceRowByColumns(
  columns: ColumnMeta[],
  row: Record<string, unknown>,
): CoerceRowResult {
  const columnsByName = new Map(columns.map((c) => [c.name, c]));
  const values: Record<string, unknown> = { ...row };
  const fieldErrors: Record<string, string> = {};

  for (const [key, raw] of Object.entries(row)) {
    const column = columnsByName.get(key);
    if (!column || typeof raw !== "string") continue;

    if (raw === "") {
      // A NOT NULL column can never accept null. Omitting the key lets a
      // database default apply, and leaves a column without one to be reported
      // as required by the insert schema.
      if (column.nullable) values[key] = null;
      else delete values[key];
      continue;
    }

    const trimmed = raw.trim();
    if (column.type === "number") {
      const n = Number(trimmed);
      if (Number.isNaN(n)) fieldErrors[key] = `"${raw}" is not a valid number`;
      else values[key] = n;
    } else if (column.type === "boolean") {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "1") values[key] = true;
      else if (lower === "false" || lower === "0") values[key] = false;
      else fieldErrors[key] = `"${raw}" is not a valid boolean (use true/false or 1/0)`;
    } else if (column.type === "date") {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) fieldErrors[key] = `"${raw}" is not a valid date`;
      else values[key] = d;
    }
  }

  return { values, fieldErrors };
}
