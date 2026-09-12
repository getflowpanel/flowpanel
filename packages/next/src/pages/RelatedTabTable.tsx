"use client";
import { DataTable, type DataTableColumn } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";

export interface RelatedTabTableProps<Row extends Record<string, unknown>> {
  /** URL key for this tab's page, so two tabs paginate independently. */
  pageParam: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  prerenderedCells?: (React.ReactNode | undefined)[][];
}

/**
 * The server renders the rows; this only moves the page through the URL, so
 * Back, Forward and reload restore the history the reader was looking at.
 */
export function RelatedTabTable<Row extends Record<string, unknown>>({
  pageParam,
  columns,
  rows,
  total,
  page,
  pageSize,
  rowKey,
  prerenderedCells,
}: RelatedTabTableProps<Row>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  return (
    <DataTable<Row>
      columns={columns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      rowKey={rowKey}
      {...(prerenderedCells ? { prerenderedCells } : {})}
      onPageChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next <= 1) params.delete(pageParam);
        else params.set(pageParam, String(next));
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    />
  );
}
