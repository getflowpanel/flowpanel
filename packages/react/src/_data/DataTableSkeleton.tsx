"use client";
import type * as React from "react";
import { cn } from "../lib/cn";
import { resolveFieldLabel } from "../lib/humanize";
import { LABEL_TEXT } from "../lib/label-text";
import { Skeleton } from "../ui/skeleton";
import type { DataTableColumn } from "./data-table-types";
import { ALIGN_CLASS, widthToCss } from "./format-cell";

export interface DataTableSkeletonProps<Row> {
  orderedVisible: DataTableColumn<Row>[];
  pageSize: number;
  rowPadding: string;
  selectionEnabled: boolean;
  rowEndCell?: unknown;
  rowEndCellLabel: string;
}

/** Placeholder rows a loading table shows: its page size, at most five. */
export function skeletonRowCount(pageSize: number): number {
  return Math.min(pageSize, 5);
}

export function DataTableSkeleton<Row>({
  orderedVisible,
  pageSize,
  rowPadding,
  selectionEnabled,
  rowEndCell,
  rowEndCellLabel,
}: DataTableSkeletonProps<Row>) {
  const skeletonRows = Array.from({ length: skeletonRowCount(pageSize) });
  return (
    <table className="fp-w-full fp-text-sm">
      <thead className={LABEL_TEXT}>
        <tr>
          {selectionEnabled ? <th scope="col" className="fp-w-10 fp-px-4 fp-py-2" /> : null}
          {orderedVisible.map((c) => {
            const wCss = widthToCss(c.width);
            return (
              <th
                key={c.field}
                scope="col"
                {...(wCss !== undefined
                  ? { style: { "--fp-col-w": wCss } as React.CSSProperties }
                  : {})}
                className={cn(
                  "fp-px-4 fp-py-2.5 fp-font-normal",
                  ALIGN_CLASS[c.align ?? "left"],
                  wCss !== undefined && "fp-w-[var(--fp-col-w)]",
                )}
              >
                {resolveFieldLabel(c.label, c.field)}
              </th>
            );
          })}
          {rowEndCell ? (
            <th scope="col" className="fp-w-10 fp-px-4 fp-py-2 fp-text-right">
              <span className="fp-sr-only">{rowEndCellLabel}</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {skeletonRows.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity.
          <tr key={`skeleton-${i}`} className="fp-border-t fp-border-line">
            {selectionEnabled ? <td className={cn("fp-px-4", rowPadding)} /> : null}
            {orderedVisible.map((c) => (
              <td key={c.field} className={cn("fp-px-4", rowPadding)}>
                <Skeleton className="fp-h-4 fp-w-24" />
              </td>
            ))}
            {rowEndCell ? <td className={cn("fp-px-4", rowPadding)} /> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
