/**
 * useMetric — fetch a single metric value from flowpanel.metrics.get.
 *
 * Legacy shape (A9 deprecated but still operational): returns `{ value, ... }`.
 * For new-style B2 helpers (metric/timeseries/breakdown) use widgets and
 * the built-in dashboard data pipeline instead — that's where sub-second
 * invalidation lives.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToInvalidation } from "./useMutation";

export function useMetric<TData = unknown>(
  baseUrl: string,
  name: string,
  options: {
    timeRange?: { start: Date; end: Date };
    /** Refetch on any invalidation tag in this list. */
    invalidatedBy?: string[];
  } = {},
): {
  data: TData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const fetchOnce = useCallback(async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/flowpanel.metrics.get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { name, timeRange: optsRef.current.timeRange },
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { result?: { data?: TData } };
      setData((body.result?.data as TData) ?? null);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, name]);

  // Initial fetch.
  useEffect(() => {
    void fetchOnce();
    return () => abortRef.current?.abort();
  }, [fetchOnce]);

  // Tag-based invalidation.
  useEffect(() => {
    const tags = options.invalidatedBy;
    if (!tags || tags.length === 0) return;
    return subscribeToInvalidation((tag) => {
      if (tags.includes(tag)) void fetchOnce();
    });
  }, [fetchOnce, options.invalidatedBy]);

  return { data, loading, error, refetch: fetchOnce };
}
