import { AsyncLocalStorage } from "node:async_hooks";
import type { RequestContext } from "../types/context.js";

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<R>(
  ctx: RequestContext,
  fn: () => Promise<R> | R,
): Promise<R> | R {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "getRequestContext() called outside of a request scope. " +
        "Wrap the call in runWithRequestContext() or use tryGetRequestContext().",
    );
  }
  return ctx;
}

export function tryGetRequestContext(): RequestContext | null {
  return storage.getStore() ?? null;
}
