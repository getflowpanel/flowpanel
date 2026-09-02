"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface UrlState {
  get: (key: string) => string | null;
  set: (updates: Record<string, string | null | undefined>) => void;
  params: URLSearchParams;
}

/**
 * Query state for surfaces that fetch their own data — the drawer and the create
 * panel. Writes go through the History API rather than the router: Next syncs
 * `useSearchParams` from it, so the URL stays shareable without paying for a
 * server round-trip the caller does not read anything from.
 */
export function useUrlState(): UrlState {
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((key: string) => params.get(key), [params]);

  const set = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(Array.from(params.entries()));
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const query = next.toString();
      window.history.pushState(null, "", query ? `${pathname}?${query}` : pathname);
    },
    [params, pathname],
  );

  return useMemo(
    () => ({ get, set, params: new URLSearchParams(Array.from(params.entries())) }),
    [get, set, params],
  );
}
