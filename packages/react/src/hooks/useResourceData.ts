"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SerializedResource, SerializedFilter } from "@flowpanel/core";

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

/**
 * Convert UI filter state (keyed by filter ID) to NormalizedFilter[] for the server.
 */
function filtersToNormalized(
  filterValues: Record<string, unknown>,
  filterDefs: SerializedFilter[],
): Array<{ field: string; op: string; value: unknown }> {
  const result: Array<{ field: string; op: string; value: unknown }> = [];

  for (const [filterId, value] of Object.entries(filterValues)) {
    if (value === undefined || value === null || value === "") continue;

    const def = filterDefs.find((f) => f.id === filterId);
    if (!def) continue;

    // Range values: { min, max } or { from, to }
    if (typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (obj.min !== undefined && obj.min !== null && obj.min !== "") {
        result.push({ field: def.path, op: "gte", value: obj.min });
      }
      if (obj.max !== undefined && obj.max !== null && obj.max !== "") {
        result.push({ field: def.path, op: "lte", value: obj.max });
      }
      if (obj.from !== undefined && obj.from !== null) {
        result.push({ field: def.path, op: "gte", value: obj.from });
      }
      if (obj.to !== undefined && obj.to !== null) {
        result.push({ field: def.path, op: "lte", value: obj.to });
      }
      continue;
    }

    // Array values → "in" operator
    if (Array.isArray(value)) {
      if (value.length > 0) {
        result.push({ field: def.path, op: "in", value });
      }
      continue;
    }

    // Boolean
    if (typeof value === "boolean") {
      result.push({ field: def.path, op: "eq", value });
      continue;
    }

    // Scalar → eq for enums, contains for text
    const mode = def.mode === "auto" ? (def.opts?.options?.length ? "enum" : "text") : def.mode;
    if (mode === "text") {
      result.push({ field: def.path, op: "contains", value });
    } else {
      result.push({ field: def.path, op: "eq", value });
    }
  }

  return result;
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
      const normalizedFilters = filtersToNormalized(filters, resource.filters);

      const response = await fetch(`${baseUrl}/flowpanel.resource.list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: resource.id,
          page,
          pageSize,
          sort,
          search: search ? { query: search } : undefined,
          filters: normalizedFilters.length > 0 ? normalizedFilters : undefined,
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
