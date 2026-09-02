import type {
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { scopeBinding } from "./scope-binding";

/** Read one row as the caller sees it — outside the bound scope it reads as absent. */
export function readRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
): Promise<Record<string, unknown> | null> {
  const itemCtx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    ...scopeBinding(config, resource, reqCtx),
  };
  return runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, itemCtx),
  ) as Promise<Record<string, unknown> | null>;
}
