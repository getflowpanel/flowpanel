"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export interface TableSort {
  field: string;
  dir: "asc" | "desc";
}

export interface UseAdminTable {
  page: number;
  sort: TableSort | null;
  filters: Record<string, string>;
  setPage: (p: number) => void;
  setSort: (s: TableSort | null) => void;
  setFilter: (field: string, value: string | null) => void;
  clearFilters: () => void;
}

/**
 * Reads and mutates the admin list URL state: `?page=`, `?sort=field:dir`,
 * `?f_<field>=value`. Mutations reset page.
 */
export function useAdminTable(): UseAdminTable {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const page = Number(sp.get("page") ?? "1") || 1;
  const sortRaw = sp.get("sort");
  const sort: TableSort | null = sortRaw
    ? (() => {
        const [field, dir] = sortRaw.split(":");
        return field && (dir === "asc" || dir === "desc") ? { field, dir } : null;
      })()
    : null;
  const filters: Record<string, string> = {};
  for (const [k, v] of sp.entries()) if (k.startsWith("f_")) filters[k.slice(2)] = v;

  const push = React.useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(sp.toString());
      mutate(next);
      const q = next.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [router, pathname, sp],
  );

  return {
    page,
    sort,
    filters,
    setPage: (p: number) => push((q) => q.set("page", String(p))),
    setSort: (s: TableSort | null) =>
      push((q) => {
        if (!s) q.delete("sort");
        else q.set("sort", `${s.field}:${s.dir}`);
      }),
    setFilter: (field: string, value: string | null) =>
      push((q) => {
        if (value == null || value === "") q.delete(`f_${field}`);
        else q.set(`f_${field}`, value);
        q.delete("page");
      }),
    clearFilters: () =>
      push((q) => {
        for (const k of Array.from(q.keys())) if (k.startsWith("f_")) q.delete(k);
      }),
  };
}
