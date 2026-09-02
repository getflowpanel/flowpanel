"use client";
import * as React from "react";

export function useOptimisticAction<T, Patch>(
  serverValue: T,
  applyPatch: (current: T, patch: Patch) => T,
): readonly [T, (patch: Patch, action: () => Promise<void>) => Promise<void>, boolean] {
  const [optimisticValue, setOptimistic] = React.useOptimistic<T, Patch>(serverValue, applyPatch);
  const [isPending, startTransition] = React.useTransition();

  const run = React.useCallback(
    (patch: Patch, action: () => Promise<void>): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        startTransition(async () => {
          setOptimistic(patch);
          try {
            await action();
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    },
    [setOptimistic],
  );

  return [optimisticValue, run, isPending] as const;
}
