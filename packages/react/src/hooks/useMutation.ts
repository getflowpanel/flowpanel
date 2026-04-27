/**
 * useMutation — minimal fetch-based mutation wrapper.
 *
 * Targets the FlowPanel tRPC procedure shape:
 *   POST `${baseUrl}/flowpanel.<path>` with JSON body { input }
 *
 * Returns `{ mutate, mutateAsync, data, error, loading }`. For anything
 * more sophisticated (optimistic updates, retries) reach for tanstack/query.
 */

import { useCallback, useRef, useState } from "react";

export interface UseMutationOptions<TInput, TResult> {
  /** Tag list — after a successful mutation, every listener registered via
   *  `useResource`/`useMetric` with an overlapping tag gets an invalidation
   *  signal. Empty array = no invalidation. */
  invalidates?: string[];
  onSuccess?: (result: TResult, input: TInput) => void;
  onError?: (error: string, input: TInput) => void;
}

const invalidationListeners = new Set<(tag: string) => void>();

/** Internal: listen for invalidation events. Returns an unsubscribe fn. */
export function subscribeToInvalidation(cb: (tag: string) => void): () => void {
  invalidationListeners.add(cb);
  return () => {
    invalidationListeners.delete(cb);
  };
}

/** Broadcast an invalidation so every listener refreshes. */
export function broadcastInvalidation(tag: string): void {
  for (const cb of invalidationListeners) cb(tag);
}

export function useMutation<TInput, TResult = unknown>(
  baseUrl: string,
  procedurePath: string,
  options: UseMutationOptions<TInput, TResult> = {},
): {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  data: TResult | null;
  error: string | null;
  loading: boolean;
} {
  const [data, setData] = useState<TResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const optsRef = useRef(options);
  optsRef.current = options;

  const mutateAsync = useCallback(
    async (input: TInput): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${baseUrl}/flowpanel.${procedurePath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => res.statusText);
          throw new Error(text || res.statusText);
        }
        const body = (await res.json()) as { result?: { data?: TResult } };
        const result = body.result?.data as TResult;
        setData(result);
        for (const tag of optsRef.current.invalidates ?? []) broadcastInvalidation(tag);
        optsRef.current.onSuccess?.(result, input);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        optsRef.current.onError?.(msg, input);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [baseUrl, procedurePath],
  );

  const mutate = useCallback(
    (input: TInput) => {
      void mutateAsync(input).catch(() => {});
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, data, error, loading };
}
