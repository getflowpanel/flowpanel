"use client";
import * as React from "react";

/**
 * Optimistic-update primitive on top of React 19's `useOptimistic` for the
 * "fire an async action against a server, show the result instantly, revert
 * on failure" pattern that row actions, bulk actions, and inline edits all
 * share.
 *
 * Returns a tuple `[optimisticValue, run, isPending]`:
 *
 * - `optimisticValue` — the value the UI should render right now. Mirrors
 *   `serverValue` when idle; reflects the optimistic patch while a `run()`
 *   is in flight or right after it resolved (until the next server
 *   reconciliation).
 * - `run(patch, action)` — apply `patch` to `optimisticValue` immediately
 *   (via `applyPatch`), then await `action()`. On resolve, the runtime keeps
 *   the patched value until the next `serverValue` arrives (typically from
 *   `router.refresh()` or RSC re-stream). On failure the optimistic value is
 *   auto-rolled back to `serverValue` **and the returned promise rejects with
 *   the original error**.
 * - `isPending` — true while the action is in flight.
 *
 * IMPORTANT: `run()` returns a promise that **rejects** when `action()` throws.
 * The revert happens automatically regardless, but callers MUST handle the
 * rejection — a discarded `run(...)` call surfaces as an unhandled promise
 * rejection. Either `await` it inside a `try/catch`, or attach a `.catch()`
 * (e.g. `void run(...).catch(() => toast.error(...))`).
 *
 * @example Row toggle
 * ```ts
 * const [row, runToggle, pending] = useOptimisticAction(
 *   serverRow,
 *   (current, next: Partial<Row>) => ({ ...current, ...next }),
 * );
 *
 * <Switch
 *   checked={row.isActive}
 *   onCheckedChange={(v) => {
 *     // Must handle the rejection — the revert is automatic, but an
 *     // unhandled rejection would otherwise escape here.
 *     void runToggle({ isActive: v }, async () => {
 *       await fetch(`/api/.../actions/toggle`, { method: "POST", body: ... });
 *     }).catch(() => toast.error("Toggle failed"));
 *   }}
 *   disabled={pending}
 * />
 * ```
 */
export function useOptimisticAction<T, Patch>(
  serverValue: T,
  applyPatch: (current: T, patch: Patch) => T,
): readonly [T, (patch: Patch, action: () => Promise<void>) => Promise<void>, boolean] {
  const [optimisticValue, setOptimistic] = React.useOptimistic<T, Patch>(serverValue, applyPatch);
  const [isPending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (patch: Patch, action: () => Promise<void>): Promise<void> => {
      // React's useOptimistic requires that `addOptimistic` is called from
      // inside a transition (otherwise React warns and the update lands as
      // a regular state set, losing the auto-revert semantics).
      return new Promise<void>((resolve, reject) => {
        startTransition(async () => {
          setOptimistic(patch);
          try {
            await action();
            resolve();
          } catch (err) {
            // React auto-reverts `optimisticValue` to `serverValue` because
            // the transition throws — re-raise so the caller can show a
            // toast or whatever.
            reject(err);
          }
        });
      });
    },
    [setOptimistic],
  );

  return [optimisticValue, run, isPending] as const;
}
