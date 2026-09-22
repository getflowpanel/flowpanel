import type { ResolvedFormatting } from "@flowpanel/core/format";
import type * as React from "react";

import { ArrayCell } from "./ArrayCell";
import type { DataTableColumn } from "./data-table-types";
import { renderCellValue } from "./format-cell";
import { JsonCell } from "./JsonCell";
import { renderFormatCell } from "./render-format";

export function renderDefaultCell<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
  formatting?: ResolvedFormatting,
): React.ReactNode {
  if (c.format) return renderFormatCell(c.format, r[c.field], formatting);
  if (c.type === "array") {
    const v = r[c.field];
    return <ArrayCell value={Array.isArray(v) ? (v as ReadonlyArray<unknown>) : null} />;
  }
  if (c.type === "json") return <JsonCell value={r[c.field]} />;
  return renderCellValue(r[c.field], formatting);
}
