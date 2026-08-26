"use client";
import type * as React from "react";
import { cn } from "../lib/cn";
import { resolveFieldLabel } from "../lib/humanize";
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

export function DataTableSkeleton<Row>({
  orderedVisible,
  pageSize,
  rowPadding,
  selectionEnabled,
  rowEndCell,
  rowEndCellLabel,
}: DataTableSkeletonProps<Row>) {
  const skeletonRows = Array.from({ length: Math.min(pageSize, 5) });
  return (
    <table className="w-full text-sm">
      <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
        <tr>
          {selectionEnabled ? <th scope="col" className="w-10 px-4 py-2" /> : null}
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
                  "px-4 py-2 font-medium",
                  ALIGN_CLASS[c.align ?? "left"],
                  wCss !== undefined && "w-[var(--fp-col-w)]",
                )}
              >
                {resolveFieldLabel(c.label, c.field)}
              </th>
            );
          })}
          {rowEndCell ? (
            <th scope="col" className="w-10 px-4 py-2 text-right">
              <span className="sr-only">{rowEndCellLabel}</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {skeletonRows.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity.
          <tr key={`skeleton-${i}`} className="border-t border-fp-border-1">
            {selectionEnabled ? <td className={cn("px-4", rowPadding)} /> : null}
            {orderedVisible.map((c) => (
              <td key={c.field} className={cn("px-4", rowPadding)}>
                <Skeleton className="h-4 w-24" />
              </td>
            ))}
            {rowEndCell ? <td className={cn("px-4", rowPadding)} /> : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
