"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ResourceDataParams } from "./useResourceData";

const PREFIX = "fp_";

function encodeValue(val: unknown): string {
  return encodeURIComponent(JSON.stringify(val));
}

function decodeValue(str: string): unknown {
  try {
    return JSON.parse(decodeURIComponent(str));
  } catch {
    return str;
  }
}

export function useUrlState(resourceId: string): {
  initialParams: ResourceDataParams;
  syncToUrl: (params: ResourceDataParams) => void;
} {
  const resourceRef = useRef(resourceId);
  resourceRef.current = resourceId;

  // Read initial state from URL on mount (SSR-safe)
  const initialParams: ResourceDataParams = (() => {
    if (typeof window === "undefined") return {};

    const sp = new URLSearchParams(window.location.search);
    const result: ResourceDataParams = {};

    const sort = sp.get(`${PREFIX}sort`);
    if (sort) {
      const decoded = decodeValue(sort) as { field: string; dir: "asc" | "desc" } | null;
      if (decoded && typeof decoded === "object" && "field" in decoded) {
        result.sort = decoded;
      }
    }

    const search = sp.get(`${PREFIX}search`);
    if (search) result.search = decodeURIComponent(search);

    const filtersStr = sp.get(`${PREFIX}filters`);
    if (filtersStr) {
      const decoded = decodeValue(filtersStr);
      if (decoded && typeof decoded === "object") {
        result.filters = decoded as Record<string, unknown>;
      }
    }

    const page = sp.get(`${PREFIX}page`);
    if (page) {
      const n = Number(page);
      if (!Number.isNaN(n) && n > 0) result.page = n;
    }

    return result;
  })();

  const syncToUrl = useCallback((params: ResourceDataParams) => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);

    // Sort
    if (params.sort) {
      sp.set(`${PREFIX}sort`, encodeValue(params.sort));
    } else {
      sp.delete(`${PREFIX}sort`);
    }

    // Search
    if (params.search) {
      sp.set(`${PREFIX}search`, encodeURIComponent(params.search));
    } else {
      sp.delete(`${PREFIX}search`);
    }

    // Filters
    if (params.filters && Object.keys(params.filters).length > 0) {
      sp.set(`${PREFIX}filters`, encodeValue(params.filters));
    } else {
      sp.delete(`${PREFIX}filters`);
    }

    // Page
    if (params.page && params.page > 1) {
      sp.set(`${PREFIX}page`, String(params.page));
    } else {
      sp.delete(`${PREFIX}page`);
    }

    const newSearch = sp.toString();
    const newUrl = newSearch
      ? `${window.location.pathname}?${newSearch}`
      : window.location.pathname;

    window.history.replaceState(null, "", newUrl);
  }, []);

  // Clear URL params for this resource when unmounting
  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      const sp = new URLSearchParams(window.location.search);
      [`${PREFIX}sort`, `${PREFIX}search`, `${PREFIX}filters`, `${PREFIX}page`].forEach((k) =>
        sp.delete(k),
      );
      const newSearch = sp.toString();
      const newUrl = newSearch
        ? `${window.location.pathname}?${newSearch}`
        : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    };
  }, []);

  return { initialParams, syncToUrl };
}
