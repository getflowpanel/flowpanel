"use client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useLabels } from "../_provider/LabelsContext.js";
import { useLiveChannel } from "../hooks/useLiveChannel.js";
import { cn } from "../lib/cn.js";
import { resolveFieldLabel } from "../lib/humanize.js";
import { Skeleton } from "../ui/skeleton.js";
import { ColumnPinMenu } from "./ColumnPinMenu.js";
import { ColumnResizer } from "./ColumnResizer.js";
import { Pagination } from "./Pagination.js";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatCell(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateFmt.format(v).replace(",", "");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return dateFmt.format(d).replace(",", "");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

function widthToCss(w: number | string | undefined): string | undefined {
  if (w === undefined) return undefined;
  return typeof w === "number" ? `${w}px` : w;
}

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
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** When provided, the caller controls row-key extraction; defaults to String(row[rowKey]). */
  getRowKey?: (row: Row) => string;
  /**
   * Server-prerendered cell content, indexed `[rowIndex][colIndex]` against
   * the `rows` array and the original `columns` array order. Used when the
   * caller wants `ColumnDef.render(row, ctx) => ReactNode` to execute on the
   * server (so the function never crosses the RSC → Client boundary). When
   * the cell entry is `undefined`, the table falls back to `column.render`
   * (if present) or to `String(row[col.field])`.
   */
  prerenderedCells?: (React.ReactNode | undefined)[][];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  pinnedColumns?: { left?: string[]; right?: string[] };
  onPinnedColumnsChange?: (pinned: { left?: string[]; right?: string[] }) => void;
  /**
   * Subscribe to an SSE channel and trigger `router.refresh()` on events.
   * Pass a string for the channel or an object with `debounceMs` (default 200).
   * Requires Next.js router context.
   */
  realtime?: string | { channel: string; debounceMs?: number };
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
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
  selection,
  onSelectionChange,
  getRowKey,
  prerenderedCells,
  columnVisibility,
  columnWidths,
  onColumnWidthsChange,
  pinnedColumns,
  onPinnedColumnsChange,
  realtime,
}: DataTableProps<Row>) {
  const router = useRouter();
  const labels = useLabels();
  const effectiveEmptyTitle = emptyTitle ?? labels.noResults;
  const [liveWidths, setLiveWidths] = React.useState<Record<string, number>>(columnWidths ?? {});
  React.useEffect(() => {
    setLiveWidths(columnWidths ?? {});
  }, [columnWidths]);
  const resizingRef = React.useRef<{ field: string; base: number } | null>(null);
  const liveWidthsRef = React.useRef(liveWidths);
  React.useEffect(() => {
    liveWidthsRef.current = liveWidths;
  }, [liveWidths]);
  const effectiveWidths = liveWidths;
  const realtimeCfg =
    typeof realtime === "string" ? { channel: realtime, debounceMs: 200 } : realtime;
  const realtimeChannel = realtimeCfg?.channel ?? "";
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLiveEvent = React.useCallback(() => {
    if (!realtimeCfg) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      router.refresh();
    }, realtimeCfg.debounceMs ?? 200);
  }, [realtimeCfg, router]);
  React.useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );
  useLiveChannel(realtimeChannel, handleLiveEvent);

  const visible = React.useMemo(
    () => columns.filter((c) => !c.hidden && (columnVisibility?.[c.field] ?? true)),
    [columns, columnVisibility],
  );

  // Map field -> original column index so we can look up `prerenderedCells`
  // (which is indexed against the original `columns` order, not the
  // reordered/visible-filtered list).
  const colIndexByField = React.useMemo(() => {
    const m = new Map<string, number>();
    columns.forEach((c, i) => m.set(c.field, i));
    return m;
  }, [columns]);

  const { leftPins, rightPins } = React.useMemo(
    () => ({
      leftPins: pinnedColumns?.left ?? [],
      rightPins: pinnedColumns?.right ?? [],
    }),
    [pinnedColumns],
  );

  const orderedVisible = React.useMemo(() => {
    const leftSet = new Set(leftPins);
    const rightSet = new Set(rightPins);
    const left: typeof visible = [];
    const middle: typeof visible = [];
    const right: typeof visible = [];
    for (const c of visible) {
      if (leftSet.has(c.field)) left.push(c);
      else if (rightSet.has(c.field)) right.push(c);
      else middle.push(c);
    }
    left.sort((a, b) => leftPins.indexOf(a.field) - leftPins.indexOf(b.field));
    right.sort((a, b) => rightPins.indexOf(a.field) - rightPins.indexOf(b.field));
    return [...left, ...middle, ...right];
  }, [visible, leftPins, rightPins]);

  const pinMeta = React.useMemo(() => {
    const map = new Map<string, { side: "left" | "right" | "none"; offset: number }>();
    let leftOffset = 0;
    for (const c of orderedVisible) {
      if (leftPins.includes(c.field)) {
        map.set(c.field, { side: "left", offset: leftOffset });
        const w = liveWidths[c.field] ?? (typeof c.width === "number" ? c.width : 120);
        leftOffset += w;
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedVisible].reverse()) {
      if (rightPins.includes(c.field)) {
        map.set(c.field, { side: "right", offset: rightOffset });
        const w = liveWidths[c.field] ?? (typeof c.width === "number" ? c.width : 120);
        rightOffset += w;
      }
    }
    for (const c of orderedVisible) {
      if (!map.has(c.field)) map.set(c.field, { side: "none", offset: 0 });
    }
    return map;
  }, [orderedVisible, leftPins, rightPins, liveWidths]);

  const rowPadding = density === "compact" ? "py-1.5" : "py-3";
  const [cursor, setCursor] = React.useState<number>(-1);
  const tbodyRef = React.useRef<HTMLTableSectionElement>(null);

  const selectionEnabled = onSelectionChange !== undefined;
  const keyOf = React.useCallback(
    (row: Row) => (getRowKey ? getRowKey(row) : String(row[rowKey])),
    [getRowKey, rowKey],
  );
  const selectionSet = React.useMemo(() => new Set(selection ?? []), [selection]);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectionSet.has(keyOf(r)));

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectionSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(Array.from(next));
  };
  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      const remaining = Array.from(selectionSet).filter((id) => !rows.some((r) => keyOf(r) === id));
      onSelectionChange(remaining);
    } else {
      const union = new Set(selectionSet);
      for (const r of rows) union.add(keyOf(r));
      onSelectionChange(Array.from(union));
    }
  };

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
              {selectionEnabled ? (
                <th scope="col" className="w-10 px-4 py-2" aria-hidden="true" />
              ) : null}
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
          <div className="text-base font-medium text-fp-text-1">{effectiveEmptyTitle}</div>
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
            {selectionEnabled ? (
              <th scope="col" className="w-10 px-4 py-2">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  aria-label={
                    allOnPageSelected
                      ? "Deselect all rows on this page"
                      : "Select all rows on this page"
                  }
                  onChange={toggleAll}
                  className="h-4 w-4 accent-fp-accent"
                />
              </th>
            ) : null}
            {orderedVisible.map((c) => {
              const active = sort?.field === c.field;
              const ariaSort: React.AriaAttributes["aria-sort"] = active
                ? sort?.dir === "asc"
                  ? "ascending"
                  : "descending"
                : "none";
              const width = effectiveWidths[c.field] ?? c.width;
              const wCss = widthToCss(width);
              const meta = pinMeta.get(c.field) ?? { side: "none" as const, offset: 0 };
              const cssVars: Record<string, string> = {};
              if (wCss !== undefined) cssVars["--fp-col-w"] = wCss;
              if (meta.side === "left") cssVars["--fp-col-pin-left"] = `${meta.offset}px`;
              else if (meta.side === "right") cssVars["--fp-col-pin-right"] = `${meta.offset}px`;
              const currentPin: "left" | "right" | null =
                meta.side === "left" ? "left" : meta.side === "right" ? "right" : null;
              return (
                <th
                  key={c.field}
                  scope="col"
                  aria-sort={c.sortable ? ariaSort : undefined}
                  {...(Object.keys(cssVars).length > 0
                    ? { style: cssVars as React.CSSProperties }
                    : {})}
                  className={cn(
                    "px-4 py-2 font-medium select-none",
                    ALIGN_CLASS[c.align ?? "left"],
                    wCss !== undefined && "w-[var(--fp-col-w)]",
                    meta.side === "left" && "sticky left-[var(--fp-col-pin-left)] bg-fp-bg-2 z-[2]",
                    meta.side === "right" &&
                      "sticky right-[var(--fp-col-pin-right)] bg-fp-bg-2 z-[2]",
                    meta.side === "none" && "relative",
                    c.sortable && "cursor-pointer hover:text-fp-text-1",
                    c.className,
                  )}
                  onClick={() => handleHeaderClick(c)}
                >
                  {resolveFieldLabel(c.label, c.field)}
                  {active ? (
                    <span aria-hidden className="ml-1">
                      {sort?.dir === "asc" ? "↑" : "↓"}
                    </span>
                  ) : null}
                  {onPinnedColumnsChange ? (
                    <ColumnPinMenu
                      field={c.field}
                      currentPin={currentPin}
                      onPin={(side) => {
                        const nextLeft = leftPins.filter((f) => f !== c.field);
                        const nextRight = rightPins.filter((f) => f !== c.field);
                        if (side === "left") nextLeft.push(c.field);
                        if (side === "right") nextRight.push(c.field);
                        onPinnedColumnsChange({ left: nextLeft, right: nextRight });
                      }}
                    />
                  ) : null}
                  {onColumnWidthsChange ? (
                    <ColumnResizer
                      onResize={(delta) => {
                        const currentBase =
                          resizingRef.current?.field === c.field
                            ? resizingRef.current.base
                            : (effectiveWidths[c.field] ??
                              (typeof c.width === "number" ? c.width : 120));
                        if (resizingRef.current?.field !== c.field) {
                          resizingRef.current = { field: c.field, base: currentBase };
                        }
                        setLiveWidths((w) => ({
                          ...w,
                          [c.field]: Math.max(40, currentBase + delta),
                        }));
                      }}
                      onResizeEnd={() => {
                        resizingRef.current = null;
                        onColumnWidthsChange?.(liveWidthsRef.current);
                      }}
                    />
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
            const key = keyOf(r);
            const active = idx === cursor;
            const isSelected = selectionEnabled && selectionSet.has(key);
            return (
              <tr
                key={key}
                aria-rowindex={idx + 1}
                aria-selected={selectionEnabled ? isSelected : undefined}
                onClick={() => onRowClick?.(r)}
                className={cn(
                  "border-t border-fp-border-1 text-fp-text-1 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-fp-bg-2",
                  active && "bg-fp-bg-2",
                )}
              >
                {selectionEnabled ? (
                  <td className={cn("px-4", rowPadding)}>
                    <input
                      type="checkbox"
                      checked={selectionSet.has(key)}
                      aria-label={`Select row ${key}`}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRow(key);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-fp-accent"
                    />
                  </td>
                ) : null}
                {orderedVisible.map((c) => {
                  const meta = pinMeta.get(c.field) ?? { side: "none" as const, offset: 0 };
                  const cssVars: Record<string, string> = {};
                  if (meta.side === "left") cssVars["--fp-col-pin-left"] = `${meta.offset}px`;
                  else if (meta.side === "right")
                    cssVars["--fp-col-pin-right"] = `${meta.offset}px`;
                  const originalColIdx = colIndexByField.get(c.field);
                  const prerendered =
                    prerenderedCells && originalColIdx !== undefined
                      ? prerenderedCells[idx]?.[originalColIdx]
                      : undefined;
                  let cellContent: React.ReactNode;
                  if (prerendered !== undefined) {
                    cellContent = prerendered;
                  } else if (c.render) {
                    cellContent = c.render(r);
                  } else {
                    cellContent = formatCell(r[c.field]);
                  }
                  return (
                    <td
                      key={c.field}
                      {...(Object.keys(cssVars).length > 0
                        ? { style: cssVars as React.CSSProperties }
                        : {})}
                      className={cn(
                        "px-4",
                        rowPadding,
                        ALIGN_CLASS[c.align ?? "left"],
                        meta.side === "left" &&
                          "sticky left-[var(--fp-col-pin-left)] bg-fp-bg-1 z-[1]",
                        meta.side === "right" &&
                          "sticky right-[var(--fp-col-pin-right)] bg-fp-bg-1 z-[1]",
                        c.className,
                      )}
                    >
                      {cellContent}
                    </td>
                  );
                })}
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
