import { columnFormatKind } from "@flowpanel/core/format";
import type { DataTableColumn } from "./data-table-types";
import { widthToCss } from "./format-cell";

/** The checkbox column; pinned columns start after it. */
export const SELECTION_WIDTH_PX = 48;
export const ROW_END_WIDTH = "3.5rem";
/** The narrowest a column without a fixed width gets before the table scrolls sideways. */
const SHARED_MIN_REM = 12;

const NUMERIC_KINDS = new Set(["money", "number", "percent", "duration"]);

/**
 * A column's width from what it holds, never from the rows on screen, so new data cannot move
 * the columns. `undefined` shares the remaining width with the other text columns.
 */
export function columnWidth<Row>(
  column: DataTableColumn<Row>,
  override?: number,
): string | undefined {
  if (override !== undefined) return `${override}px`;
  if (column.width !== undefined) return widthToCss(column.width);
  const kind = column.format === undefined ? undefined : columnFormatKind(column.format);
  if (kind === "boolean" || (kind === undefined && column.type === "boolean")) return "6.5rem";
  if (kind === "badge" || (kind === undefined && column.type === "enum")) return "9rem";
  if (kind === "relative") return "9rem";
  if (kind === "date" || (kind === undefined && column.type === "date")) return "11rem";
  if (
    (kind !== undefined && NUMERIC_KINDS.has(kind)) ||
    (kind === undefined && column.type === "number")
  )
    return "8rem";
  return undefined;
}

/** The width below which the frame scrolls sideways instead of squeezing the columns. */
export function tableMinWidth(widths: ReadonlyArray<string | undefined>, extras: string[]): string {
  const parts = [...extras, ...widths.map((width) => width ?? `${SHARED_MIN_REM}rem`)];
  return parts.length === 0 ? "100%" : `calc(${parts.join(" + ")})`;
}
