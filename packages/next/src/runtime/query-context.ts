import type { ItemQueryContext, QueryContext, RequestContext } from "@flowpanel/core";

/** A query context outside any dashboard: all time, no page params, never aborted. */
export function requestQueryContext(reqCtx: RequestContext): QueryContext {
  return {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
  };
}

/** The same context, aimed at one row. */
export function itemQueryContext(
  reqCtx: RequestContext,
  id: string,
  extra: Partial<ItemQueryContext> = {},
): ItemQueryContext {
  return { ...requestQueryContext(reqCtx), id, ...extra };
}
