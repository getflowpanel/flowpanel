"use client";
import { DataTable, type DataTableColumn, type DataTableSort } from "@flowpanel/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";

export interface RelatedTabTableProps<Row extends Record<string, unknown>> {
  /** URL key for this tab's page, so two tabs paginate independently. */
  pageParam: string;
  /** URL key for this tab's sort, written as `<field>.<asc|desc>`. */
  sortParam?: string;
  sort?: DataTableSort<Row> | null;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  prerenderedCells?: (React.ReactNode | undefined)[][];
  /** Target resource's own list, with this relationship already filtered. */
  openListHref?: string;
  openListLabel?: string;
}

/**
 * The server renders the rows; this only moves the page and the sort through the
 * URL, so Back, Forward and reload restore the history the reader was looking at.
 */
export function RelatedTabTable<Row extends Record<string, unknown>>({
  pageParam,
  sortParam,
  sort = null,
  columns,
  rows,
  total,
  page,
  pageSize,
  rowKey,
  prerenderedCells,
  openListHref,
  openListLabel,
}: RelatedTabTableProps<Row>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const push = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-2">
      {openListHref ? (
        <div className="flex justify-end">
          <Link
            href={openListHref}
            className="text-sm text-fp-accent hover:underline focus-visible:underline"
          >
            {openListLabel}
          </Link>
        </div>
      ) : null}
      <DataTable<Row>
        columns={columns}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        rowKey={rowKey}
        sort={sort}
        {...(prerenderedCells ? { prerenderedCells } : {})}
        {...(sortParam
          ? {
              onSortChange: (next) => {
                push((params) => {
                  params.delete(pageParam);
                  params.set(sortParam, `${String(next.field)}.${next.dir}`);
                });
              },
            }
          : {})}
        onPageChange={(next) => {
          push((params) => {
            if (next <= 1) params.delete(pageParam);
            else params.set(pageParam, String(next));
          });
        }}
      />
    </div>
  );
}
