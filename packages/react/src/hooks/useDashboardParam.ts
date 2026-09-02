"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import type { z } from "zod";

export interface UseDashboardParamResult<T> {
  /** Current value: the validated URL param, or `fallback` if absent/invalid. */
  value: T;
  /** Write the value to the URL (soft navigation, no scroll reset). */
  setValue: (next: T) => void;
  /** True while the soft navigation triggered by `setValue` is in flight. */
  pending: boolean;
}

/** Serialize a scalar param value to its URL string form. */
function serializeParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** Type-safe reader/writer for a single dashboard URL search param. */
export function useDashboardParam<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): UseDashboardParamResult<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const value = useMemo<T>(() => {
    const raw = searchParams?.get(key) ?? null;
    if (raw === null) return fallback;
    const parsed = schema.safeParse(raw);
    return parsed.success ? parsed.data : fallback;
  }, [searchParams, key, schema, fallback]);

  const setValue = useCallback(
    (next: T) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      const serialized = serializeParam(next);
      if (serialized === null || serialized === serializeParam(fallback)) {
        sp.delete(key);
      } else {
        sp.set(key, serialized);
      }
      const qs = sp.toString();
      const href = qs ? `${pathname}?${qs}` : (pathname ?? "/");
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [searchParams, pathname, router, key, fallback],
  );

  return { value, setValue, pending };
}
