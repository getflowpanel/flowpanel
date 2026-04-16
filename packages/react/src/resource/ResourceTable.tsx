"use client";

import type { SerializedResource } from "@flowpanel/core";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cn } from "../utils/cn";
import { getNestedValue } from "../utils/getNestedValue";
import { CellRenderer } from "./cells";

const SKELETON_ROWS = 8;

export function ResourceTable({
  resource,
  data,
  loading,
  sort,
  onSort,
  onRowClick,
  selectedRowId,
  selection,
  onSelectionChange,
}: {
  resource: SerializedResource;
  data: Record<string, unknown>[];
  loading: boolean;
  sort?: { field: string; dir: "asc" | "desc" };
  onSort?: (field: string) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  selectedRowId?: string;
  /** Selected ids for bulk actions. Undefined disables selection column. */
  selection?: Array<string | number>;
  onSelectionChange?: (ids: Array<string | number>) => void;
}) {
  const visibleColumns = resource.columns.filter((c) => c.opts.visible !== "detail");
  const primaryKey = resource.primaryKey;
  const selectionEnabled = Boolean(selection && onSelectionChange);
  const selectedSet = new Set(selection ?? []);

  const allVisible = data.map((r) => r[primaryKey] as string | number);
  const allSelected = allVisible.length > 0 && allVisible.every((id) => selectedSet.has(id));
  const someSelected = allVisible.some((id) => selectedSet.has(id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selection?.filter((id) => !allVisible.includes(id)) ?? []);
    } else {
      const merged = new Set([...(selection ?? []), ...allVisible]);
      onSelectionChange(Array.from(merged));
    }
  };

  const toggleRow = (id: string | number) => {
    if (!onSelectionChange) return;
    const next = selectedSet.has(id)
      ? (selection ?? []).filter((x) => x !== id)
      : [...(selection ?? []), id];
    onSelectionChange(next);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectionEnabled && (
            <TableHead className="w-10">
              <input
                type="checkbox"
                aria-label={allSelected ? "Deselect all" : "Select all"}
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer accent-primary"
                onClick={(e) => e.stopPropagation()}
              />
            </TableHead>
          )}

          {visibleColumns.map((col) => {
            const isSorted = sort?.field === (col.path ?? col.id);
            const isSortable = col.opts.sortable !== false && col.type === "field" && col.path;

            return (
              <TableHead
                key={col.id}
                className={cn(
                  col.opts.width ? `w-[${col.opts.width}px]` : "",
                  col.opts.align === "right" && "text-right",
                  col.opts.align === "center" && "text-center",
                  isSortable && "cursor-pointer select-none hover:text-foreground",
                )}
                onClick={isSortable && onSort ? () => onSort(col.path!) : undefined}
                style={col.opts.width ? { width: col.opts.width } : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {isSortable && (
                    <span className="text-muted-foreground">
                      {isSorted ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </span>
                  )}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading && data.length === 0
          ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <TableRow key={`skel-${i}`}>
                {selectionEnabled && (
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                )}
                {visibleColumns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : data.map((row, rowIdx) => {
              const id = (row[primaryKey] as string | number) ?? rowIdx;
              const rowId = String(id);
              const isSelected = selectedRowId === rowId;
              const isChecked = selectedSet.has(id);

              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected || isChecked ? "selected" : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    (isSelected || isChecked) && "bg-muted/60",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectionEnabled && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={isChecked ? "Deselect row" : "Select row"}
                        checked={isChecked}
                        onChange={() => toggleRow(id)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </TableCell>
                  )}
                  {visibleColumns.map((col) => {
                    const value = col.path ? getNestedValue(row, col.path) : undefined;
                    return (
                      <TableCell
                        key={col.id}
                        className={cn(
                          col.opts.align === "right" && "text-right",
                          col.opts.align === "center" && "text-center",
                        )}
                      >
                        <CellRenderer column={col} value={value} row={row} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
      </TableBody>
    </Table>
  );
}
