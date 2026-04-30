"use client";
import type { ActionResult } from "@flowpanel/core";
import { useCallback, useState } from "react";

export interface UseAdminMutationOptions<Prev = unknown> {
  /** Produce the optimistic next state from the previous state and the call args. */
  optimistic?: (prev: Prev | null, ...args: unknown[]) => Prev;
  /** Rollback strategy when the action returns { ok: false } or throws. Defaults to "error". */
  rollbackOn?: "error";
  onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void;
  onError?: (message: string) => void;
}

export interface UseAdminMutation<Args extends unknown[]> {
  run: (...args: Args) => Promise<ActionResult>;
  pending: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Client hook wrapping a Server Action that returns an `ActionResult`.
 *
 * @example
 *   const update = useAdminMutation(admin.users.update, {
 *     onSuccess: (r) => toast(r.message ?? "Saved"),
 *     onError: (e) => toast.error(e),
 *   });
 *   <button onClick={() => update.run(user.id, { role: "admin" })}>Promote</button>
 */
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
    [action, options],
  );

  const reset = useCallback(() => {
    setPending(false);
    setError(null);
  }, []);

  return { run, pending, error, reset };
}
