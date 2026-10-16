"use client";
import { cn } from "../lib/cn";
import { LABEL_TEXT } from "../lib/label-text";
import { Skeleton } from "../ui/skeleton";
import { columnLabel } from "./column-label";
import { SELECTION_WIDTH_PX } from "./column-sizing";
import type { DataTableColumn } from "./data-table-types";
import { ALIGN_CLASS } from "./format-cell";
import { TableScroll } from "./TableScroll";

export interface DataTableSkeletonProps<Row> {
  orderedVisible: DataTableColumn<Row>[];
  /** The loaded table's column widths, so no column moves when the rows arrive. */
  widths: ReadonlyMap<string, string>;
  minWidth: string;
  pageSize: number;
  rowPadding: string;
  selectionEnabled: boolean;
  /** The trailing column's width, when the table has one. */
  rowEndWidth?: string | undefined;
  rowEndCellLabel: string;
}

/** Placeholder rows a loading table shows: its page size, at most five. */
export function skeletonRowCount(pageSize: number): number {
  return Math.min(pageSize, 5);
}

export function DataTableSkeleton<Row>({
  orderedVisible,
  widths,
  minWidth,
  pageSize,
  rowPadding,
  selectionEnabled,
  rowEndWidth,
  rowEndCellLabel,
}: DataTableSkeletonProps<Row>) {
  const skeletonRows = Array.from({ length: skeletonRowCount(pageSize) });
  return (
    <TableScroll>
      <table className="fp-w-full fp-table-fixed fp-text-sm" style={{ minWidth }}>
        <thead className={LABEL_TEXT}>
          <tr>
            {selectionEnabled ? (
              <th scope="col" style={{ width: SELECTION_WIDTH_PX }} className="fp-px-4 fp-py-2" />
            ) : null}
            {orderedVisible.map((c) => {
              const width = widths.get(c.field);
              return (
                <th
                  key={c.field}
                  scope="col"
                  {...(width !== undefined ? { style: { width } } : {})}
                  className={cn(
                    "fp-overflow-hidden fp-text-ellipsis fp-whitespace-nowrap fp-px-4 fp-py-2.5 fp-font-normal",
                    ALIGN_CLASS[c.align ?? "left"],
                  )}
                >
                  {columnLabel(c)}
                </th>
              );
            })}
            {rowEndWidth ? (
              <th
                scope="col"
                style={{ width: rowEndWidth }}
                className="fp-px-4 fp-py-2 fp-text-right"
              >
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
                  <Skeleton className="fp-h-4 fp-w-full fp-max-w-24" />
                </td>
              ))}
              {rowEndWidth ? <td className={cn("fp-px-4", rowPadding)} /> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

/** The phone list's placeholder: one card per row with the first column as its title, as the loaded cards read. */
export function CardListSkeleton<Row>({
  orderedVisible,
  pageSize,
}: Pick<DataTableSkeletonProps<Row>, "orderedVisible" | "pageSize">) {
  const fields = orderedVisible.slice(1);
  return (
    <ul className="fp-space-y-2 fp-p-2">
      {Array.from({ length: skeletonRowCount(pageSize) }, (_, i) => `card-${i}`).map((key) => (
        <li key={key} className="fp-rounded fp-border fp-border-line fp-bg-surface fp-px-4 fp-py-3">
          <div className="fp-flex fp-h-6 fp-items-center">
            <Skeleton className="fp-h-4 fp-w-32" />
          </div>
          <dl className="fp-mt-2 fp-grid fp-grid-cols-[max-content_1fr] fp-gap-x-3 fp-gap-y-1 fp-text-sm">
            {fields.map((c) => (
              <div key={c.field} className="fp-contents">
                <dt className="fp-text-faint">{columnLabel(c)}</dt>
                <dd className="fp-flex fp-h-5 fp-items-center">
                  <Skeleton className="fp-h-4 fp-w-full fp-max-w-32" />
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
