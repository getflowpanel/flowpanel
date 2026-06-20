import type * as React from "react";

import { ArrayCell } from "./ArrayCell.js";
import type { DataTableColumn } from "./data-table-types.js";
import { renderCellValue } from "./format-cell.js";
import { JsonCell } from "./JsonCell.js";
import { renderFormatCell } from "./render-format.js";

export function renderDefaultCell<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
): React.ReactNode {
  if (c.format) return renderFormatCell(c.format, r[c.field]);
  if (c.type === "array") {
    const v = r[c.field];
    return <ArrayCell value={Array.isArray(v) ? (v as ReadonlyArray<unknown>) : null} />;
  }
  if (c.type === "json") return <JsonCell value={r[c.field]} />;
  return renderCellValue(r[c.field]);
}
