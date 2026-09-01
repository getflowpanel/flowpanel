"use client";
import type { ActionResult } from "@flowpanel/core";
import { useCallback, useState } from "react";

export interface UseAdminMutationOptions {
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void;
  onError?: (message: string) => void;
}

export interface UseAdminMutation<Args extends unknown[]> {
  run: (...args: Args) => Promise<ActionResult>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

/** Client hook wrapping an async action that returns an `ActionResult`. */
export function useAdminMutation<Args extends unknown[]>(
  action: (...args: Args) => Promise<ActionResult>,
  options: UseAdminMutationOptions = {},
): UseAdminMutation<Args> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<ActionResult> => {
      setPending(true);
      setError(null);
      try {
        const res = await action(...args);
        if (res.ok) {
          options.onSuccess?.(res);
        } else {
          setError(res.error);
          options.onError?.(res.error);
        }
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
        options.onError?.(msg);
        return { ok: false, error: msg };
      } finally {
        setPending(false);
      }
    },
    // Inline `options` literals must not defeat the memo; the two callbacks are
    // the only values `run` reads from it.
    [action, options.onSuccess, options.onError],
  );

  const reset = useCallback(() => {
    setPending(false);
    setError(null);
  }, []);

  return { run, pending, error, reset };
}
