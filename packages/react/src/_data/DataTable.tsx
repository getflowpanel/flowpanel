"use client";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { Skeleton } from "../ui/skeleton.js";
import { Pagination } from "./Pagination.js";

export interface DataTableColumn<Row> {
  field: keyof Row & string;
  label?: string;
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  hidden?: boolean;
  className?: string;
}

export interface DataTableSort<Row> {
  field: keyof Row & string;
  dir: "asc" | "desc";
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  density?: "comfortable" | "compact";
  loading?: boolean;
  onRowClick?: (row: Row) => void;
  onSortChange?: (sort: DataTableSort<Row>) => void;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  total,
  page,
  pageSize,
  rowKey,
  sort = null,
  density = "comfortable",
  loading = false,
  onRowClick,
  onSortChange,
  onPageChange,
  emptyTitle = "No data",
  emptyDescription,
  emptyAction,
  className,
}: DataTableProps<Row>) {
  const visible = React.useMemo(() => columns.filter((c) => !c.hidden), [columns]);
  const rowPadding = density === "compact" ? "py-1.5" : "py-3";
  const [cursor, setCursor] = React.useState<number>(-1);
  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);

  // Reset cursor when the row set changes (new page, filter, etc).
  // biome-ignore lint/correctness/useExhaustiveDependencies: rows identity change is the trigger.
  React.useEffect(() => {
    setCursor(-1);
  }, [rows]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (rows.length === 0) return;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c < 0 ? 0 : c + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      if (cursor >= 0) {
        const row = rows[cursor];
        if (row !== undefined) onRowClick?.(row);
      }
    } else if (e.key === "Escape") {
      setCursor(-1);
    }
  };

  const handleHeaderClick = (c: DataTableColumn<Row>) => {
    if (!c.sortable) return;
    const active = sort?.field === c.field;
    const nextDir: "asc" | "desc" = active && sort?.dir === "asc" ? "desc" : "asc";
    onSortChange?.({ field: c.field, dir: nextDir });
  };

  const frame = "rounded-fp border border-fp-border-1 bg-fp-bg-1 overflow-hidden";

  if (loading) {
    const skeletonRows = Array.from({ length: Math.min(pageSize, 5) });
    return (
      <div className={cn(frame, className)} aria-busy="true">
        <table className="w-full text-sm">
          <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
            <tr>
              {visible.map((c) => (
                <th
                  key={c.field}
                  scope="col"
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                  className="px-4 py-2 font-medium"
                >
                  {c.label ?? c.field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skeletonRows.map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have no stable identity.
              <tr key={`skeleton-${i}`} className="border-t border-fp-border-1">
                {visible.map((c) => (
                  <td key={c.field} className={cn("px-4", rowPadding)}>
                    <Skeleton className="h-4 w-24" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn(frame, className)}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-base font-medium text-fp-text-1">{emptyTitle}</div>
          {emptyDescription ? (
            <div className="mt-1 text-sm text-fp-text-3">{emptyDescription}</div>
          ) : null}
          {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(frame, className)}>
      <table className="w-full text-sm">
        <thead className="bg-fp-bg-2 text-fp-text-2 text-xs uppercase tracking-wide">
          <tr>
            {visible.map((c) => {
              const active = sort?.field === c.field;
              const ariaSort: React.AriaAttributes["aria-sort"] = active
                ? sort?.dir === "asc"
                  ? "ascending"
                  : "descending"
                : "none";
              return (
                <th
                  key={c.field}
                  scope="col"
                  aria-sort={c.sortable ? ariaSort : undefined}
                  style={{ width: c.width, textAlign: c.align ?? "left" }}
                  className={cn(
                    "px-4 py-2 font-medium select-none",
                    c.sortable && "cursor-pointer hover:text-fp-text-1",
                    c.className,
                  )}
                  onClick={() => handleHeaderClick(c)}
                >
                  {c.label ?? c.field}
                  {active ? (
                    <span aria-hidden className="ml-1">
                      {sort?.dir === "asc" ? "↑" : "↓"}
                    </span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        {/* tbody is focusable to host keyboard navigation (j/k/Enter/Esc); a11y rule disabled in biome.json override. */}
        <tbody
          ref={tbodyRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-fp-accent focus-visible:ring-inset"
        >
          {rows.map((r, idx) => {
            const key = String(r[rowKey]);
            const active = idx === cursor;
            return (
              <tr
                key={key}
                aria-rowindex={idx + 1}
                onClick={() => onRowClick?.(r)}
                className={cn(
                  "border-t border-fp-border-1 text-fp-text-1 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-fp-bg-2",
                  active && "bg-fp-bg-2",
                )}
              >
                {visible.map((c) => (
                  <td
                    key={c.field}
                    style={{ textAlign: c.align ?? "left" }}
                    className={cn("px-4", rowPadding, c.className)}
                  >
                    {c.render ? c.render(r) : String(r[c.field] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        {...(onPageChange ? { onChange: onPageChange } : {})}
      />
    </div>
  );
}
