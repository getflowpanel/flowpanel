"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedResource } from "@flowpanel/core";

export interface ResourceDataParams {
  sort?: { field: string; dir: "asc" | "desc" };
  search?: string;
  filters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}

export interface ResourceDataState {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}

export interface UseResourceDataReturn extends ResourceDataState {
  sort?: { field: string; dir: "asc" | "desc" };
  search: string;
  filters: Record<string, unknown>;
  setPage: (page: number) => void;
  setSort: (field: string) => void;
  setSearch: (search: string) => void;
  setFilter: (filterId: string, value: unknown) => void;
  clearFilters: () => void;
  refresh: () => void;
}

export function useResourceData({
  resource,
  baseUrl,
  initialParams,
}: {
  resource: SerializedResource;
  baseUrl: string;
  initialParams?: ResourceDataParams;
}): UseResourceDataReturn {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(initialParams?.page ?? 1);
  const [pageSize] = useState(initialParams?.pageSize ?? resource.defaultPageSize ?? 50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSortState] = useState<{ field: string; dir: "asc" | "desc" } | undefined>(
    initialParams?.sort ?? resource.defaultSort,
  );
  const [search, setSearchState] = useState(initialParams?.search ?? "");
  const [filters, setFiltersState] = useState<Record<string, unknown>>(
    initialParams?.filters ?? {},
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Abort controller ref to cancel in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/flowpanel.resource.list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          page,
          pageSize,
          sort,
          search: search || undefined,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const json = (await response.json()) as
        | { result?: { data?: { data: Record<string, unknown>[]; total: number } } }
        | { data: Record<string, unknown>[]; total: number };

      // Support both tRPC envelope and plain JSON
      const payload =
        "result" in json && json.result?.data
          ? json.result.data
          : (json as { data: Record<string, unknown>[]; total: number });

      setData(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [resource.id, baseUrl, page, pageSize, sort, search, filters]);

  useEffect(() => {
    void fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  const setPage = useCallback((p: number) => setPageState(p), []);

  const setSort = useCallback((field: string) => {
    setSortState((prev) => {
      if (prev?.field === field) {
        return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { field, dir: "asc" };
    });
    setPageState(1);
  }, []);

  const setSearch = useCallback((s: string) => {
    setSearchState(s);
    setPageState(1);
  }, []);

  const setFilter = useCallback((filterId: string, value: unknown) => {
    setFiltersState((prev) => ({ ...prev, [filterId]: value }));
    setPageState(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState({});
    setSearchState("");
    setPageState(1);
  }, []);

  const refresh = useCallback(() => void fetchData(), [fetchData]);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    sort,
    search,
    filters,
    setPage,
    setSort,
    setSearch,
    setFilter,
    clearFilters,
    refresh,
  };
}
