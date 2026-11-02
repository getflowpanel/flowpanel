"use client";
import type { ColumnFormat } from "@flowpanel/core";
import { humanize, renderFormatCell, useFormatting, useLabels } from "@flowpanel/react";
import { formatFieldValue } from "../runtime/format-field-value";
import type { SerializedWidget } from "./drawer-payload";

/** A `table()` widget's rows inside the drawer. */
export function DrawerTableWidget({
  widget,
}: {
  widget: Extract<SerializedWidget, { kind: "table" }>;
}) {
  const formatting = useFormatting();
  const labels = useLabels();
  if (widget.rows.length === 0) {
    return (
      <div className="fp-py-6 fp-text-sm fp-text-faint md:fp-col-span-2">{labels.widget.empty}</div>
    );
  }
  const cols: { field: string; label?: string; format?: ColumnFormat }[] =
    widget.columns.length > 0
      ? widget.columns
      : Object.keys(widget.rows[0] ?? {}).map((f) => ({ field: f }));
  return (
    <div className="fp-overflow-hidden fp-rounded fp-border fp-border-line fp-bg-surface md:fp-col-span-2">
      {widget.label ? (
        <div className="fp-border-b fp-border-line fp-bg-canvas fp-px-4 fp-py-2 fp-text-xs fp-font-medium fp-text-soft">
          {widget.label}
        </div>
      ) : null}
      <table className="fp-w-full fp-text-sm">
        <thead className="fp-bg-canvas fp-text-xs fp-text-faint">
          <tr>
            {cols.map((c) => (
              <th key={c.field} scope="col" className="fp-px-4 fp-py-2 fp-text-left fp-font-normal">
                {c.label ?? humanize(c.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {widget.rows.map((r, idx) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: server-resolved list without stable id
              key={idx}
              className="fp-border-t fp-border-line fp-text-ink"
            >
              {cols.map((c) => (
                <td key={c.field} className="fp-px-4 fp-py-2">
                  {c.format
                    ? renderFormatCell(c.format, r[c.field], formatting)
                    : formatFieldValue(r[c.field])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
