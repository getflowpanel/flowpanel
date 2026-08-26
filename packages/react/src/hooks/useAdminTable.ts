"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

export interface TableSort {
  field: string;
  dir: "asc" | "desc";
}

export interface UseAdminTable {
  page: number;
  /** `?perPage=`, or null when the resource's configured size applies. */
  pageSize: number | null;
  search: string;
  sort: TableSort | null;
  filters: Record<string, string>;
  setPage: (p: number) => void;
  setPageSize: (n: number | null) => void;
  setSearch: (q: string) => void;
  setSort: (s: TableSort | null) => void;
  setFilter: (field: string, value: string | null) => void;
  clearFilters: () => void;
}

/** Reads and mutates the admin list URL state: `?page=`, `?sort=field:dir`, `?f_<field>=value`. */
export function useAdminTable(): UseAdminTable {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const pageRaw = Number(sp.get("page") ?? "1");
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.trunc(pageRaw)) : 1;
  const pageSize = Number(sp.get("perPage")) || null;
  const search = sp.get("q") ?? "";
  const sortRaw = sp.get("sort");
  const sort: TableSort | null = sortRaw
    ? (() => {
        const [field, dir] = sortRaw.split(":");
        return field && (dir === "asc" || dir === "desc") ? { field, dir } : null;
      })()
    : null;
  const filters: Record<string, string> = {};
  for (const [k, v] of sp.entries()) if (k.startsWith("f_")) filters[k.slice(2)] = v;

  // Replace, not push: list state changes on every keystroke of a filter, and a
  // history stack of them means Back walks the filters instead of leaving.
  const navigate = React.useCallback(
    (mutate: (p: URLSearchParams) => void, scroll = false) => {
      const next = new URLSearchParams(sp.toString());
      mutate(next);
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll });
    },
    [router, pathname, sp],
  );

  const setPage = React.useCallback(
    (p: number) => navigate((q) => q.set("page", String(p)), true),
    [navigate],
  );
  // Resizing the page invalidates the offset, so drop back to the first page.
  const setPageSize = React.useCallback(
    (n: number | null) =>
      navigate((q) => {
        if (n == null) q.delete("perPage");
        else q.set("perPage", String(n));
        q.delete("page");
      }, true),
    [navigate],
  );
  const setSearch = React.useCallback(
    (val: string) =>
      navigate((q) => {
        if (val === "") q.delete("q");
        else q.set("q", val);
        q.delete("page");
      }),
    [navigate],
  );
  const setSort = React.useCallback(
    (s: TableSort | null) =>
      navigate((q) => {
        if (!s) q.delete("sort");
        else q.set("sort", `${s.field}:${s.dir}`);
      }),
    [navigate],
  );
  const setFilter = React.useCallback(
    (field: string, value: string | null) =>
      navigate((q) => {
        if (value == null || value === "") q.delete(`f_${field}`);
        else q.set(`f_${field}`, value);
        q.delete("page");
      }),
    [navigate],
  );
  const clearFilters = React.useCallback(
    () =>
      navigate((q) => {
        for (const k of Array.from(q.keys())) if (k.startsWith("f_")) q.delete(k);
      }),
    [navigate],
  );

  return {
    page,
    pageSize,
    search,
    sort,
    filters,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    clearFilters,
  };
}
