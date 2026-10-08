/** Surfaces a subscriber's error without stopping delivery to the others: `reportError` where it exists, else an async rethrow. */
export function reportListenerError(error: unknown): void {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else
    queueMicrotask(() => {
      throw error;
    });
}
