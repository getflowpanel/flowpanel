import { humanizeReference, resolveFieldLabel } from "../lib/humanize";
import type { DataTableColumn } from "./data-table-types";

/** A column's header: its label, else its field made readable; a reference column drops its "ID". */
export function columnLabel<Row>(column: DataTableColumn<Row>): string {
  if (column.label === undefined && column.type === "reference") {
    return humanizeReference(column.field);
  }
  return resolveFieldLabel(column.label, column.field);
}
