import type { ColumnMeta, ResolvedLabels } from "@flowpanel/core";
import { formatLabel, humanize } from "@flowpanel/core";

export interface CoerceRowResult {
  /** The row with column-typed values swapped in for coercible string cells. */
  values: Record<string, unknown>;
  /** Per-field messages for cells that could not be coerced to their column's type. */
  fieldErrors: Record<string, string>;
}

/**
 * Coerce a raw row's string cells to the JS type its column expects, ahead of Zod
 * validation. A cell that cannot be coerced is reported through `labels.form`,
 * naming the column the way the form's label does.
 */
export function coerceRowByColumns(
  columns: ColumnMeta[],
  row: Record<string, unknown>,
  labels: ResolvedLabels,
): CoerceRowResult {
  const columnsByName = new Map(columns.map((c) => [c.name, c]));
  const values: Record<string, unknown> = { ...row };
  const fieldErrors: Record<string, string> = {};

  const invalid = (key: string, template: string): void => {
    fieldErrors[key] = formatLabel(template, { label: humanize(key) });
  };

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
      if (Number.isNaN(n)) invalid(key, labels.form.invalidNumber);
      else values[key] = n;
    } else if (column.type === "boolean") {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "1") values[key] = true;
      else if (lower === "false" || lower === "0") values[key] = false;
      else invalid(key, labels.form.invalidBoolean);
    } else if (column.type === "date") {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) invalid(key, labels.form.invalidDate);
      else values[key] = d;
    }
  }

  return { values, fieldErrors };
}
