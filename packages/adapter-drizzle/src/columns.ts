import {
  getTableColumns,
  getTableName,
  getViewName,
  getViewSelectedFields,
  isView,
  type Table,
  type View,
} from "drizzle-orm";

/** A table's columns, or the columns a view selects. */
export function columnsOf(ref: unknown): Record<string, unknown> {
  return isView(ref) ? getViewSelectedFields(ref as View) : getTableColumns(ref as Table);
}

/** The table's or the view's name. */
export function refName(ref: unknown): string {
  return isView(ref) ? getViewName(ref as View) : getTableName(ref as Table);
}
