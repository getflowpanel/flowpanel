"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { humanize, useLabels } from "@flowpanel/react";
import { formatFieldValue } from "../runtime/format-field-value";
import type { SerializedDrawerTab } from "./drawer-payload";

/** A related resource's rows for this record, as a plain table. */
export function DrawerResourceTab({
  tab,
}: {
  tab: Extract<SerializedDrawerTab, { kind: "resource" }>;
}) {
  const words = useLabels().drawer;
  if (tab.rows.length === 0) {
    return (
      <div className="fp-py-6 fp-text-sm fp-text-faint">
        {formatLabel(words.noRows, { resource: tab.label })}
      </div>
    );
  }
  const cols = tab.columns.length > 0 ? tab.columns : Object.keys(tab.rows[0] ?? {});
  return (
    <div className="fp-overflow-hidden fp-rounded fp-border fp-border-line fp-bg-surface">
      <table className="fp-w-full fp-text-sm">
        <thead className="fp-bg-canvas fp-text-xs fp-text-faint">
          <tr>
            {cols.map((c) => (
              <th key={c} scope="col" className="fp-px-4 fp-py-2 fp-text-left fp-font-normal">
                {tab.columnLabels[c] ?? humanize(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((r, idx) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: drawer list has no stable row key at this layer and reorders only on refresh.
              key={idx}
              className="fp-border-t fp-border-line fp-text-ink"
            >
              {cols.map((c) => (
                <td key={c} className="fp-px-4 fp-py-2">
                  {formatFieldValue(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
