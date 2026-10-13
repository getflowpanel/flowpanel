"use client";
import { Pagination } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface UrlPaginationProps {
  /** The URL key that holds the page number. */
  param: string;
  page: number;
  pageSize: number;
  total: number;
}

/** Pagination whose page lives in the URL, so Back and reload keep it. */
export function UrlPagination({ param, page, pageSize, total }: UrlPaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  if (total <= pageSize) return null;
  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next <= 1) params.delete(param);
        else params.set(param, String(next));
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    />
  );
}
