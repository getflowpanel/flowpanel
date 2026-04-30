"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export interface UrlState {
  get: (key: string) => string | null;
  set: (updates: Record<string, string | null | undefined>) => void;
  params: URLSearchParams;
}

export function useUrlState(): UrlState {
  const router = useRouter();
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
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return useMemo(
    () => ({ get, set, params: new URLSearchParams(Array.from(params.entries())) }),
    [get, set, params],
  );
}
