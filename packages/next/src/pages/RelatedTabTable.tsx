"use client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  useRowHrefClick,
} from "@flowpanel/react";
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
  /** Per-row destinations, indexed like `rows`. `null` leaves that row inert. */
  rowHrefs?: (string | null)[];
  /** Shown instead of the generic label when there are no rows. */
  emptyTitle?: string;
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
  rowHrefs,
  emptyTitle,
}: RelatedTabTableProps<Row>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const onRowClick = useRowHrefClick(rows, rowHrefs);

  const push = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="fp-space-y-2">
      {openListHref ? (
        <div className="fp-flex fp-justify-end">
          <Link
            href={openListHref}
            className="fp-text-sm fp-text-soft fp-underline-offset-4 hover:fp-text-ink hover:fp-underline focus-visible:fp-underline"
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
        {...(emptyTitle ? { emptyTitle } : {})}
        {...(onRowClick ? { onRowClick } : {})}
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
