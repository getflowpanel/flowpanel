"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import type { SerializedResource } from "@flowpanel/core";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../utils/cn";
import { CellRenderer } from "./cells";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const SKELETON_ROWS = 8;

export function ResourceTable({
  resource,
  data,
  loading,
  sort,
  onSort,
  onRowClick,
  selectedRowId,
}: {
  resource: SerializedResource;
  data: Record<string, unknown>[];
  loading: boolean;
  sort?: { field: string; dir: "asc" | "desc" };
  onSort?: (field: string) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  selectedRowId?: string;
}) {
  const visibleColumns = resource.columns.filter((c) => c.opts.visible !== "detail");
  const primaryKey = "id";

  return (
    <Table>
      <TableHeader>
        <TableRow>
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
                {visibleColumns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : data.map((row, rowIdx) => {
              const rowId = String(row[primaryKey] ?? rowIdx);
              const isSelected = selectedRowId === rowId;

              return (
                <TableRow
                  key={rowId}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer", isSelected && "bg-muted")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
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
