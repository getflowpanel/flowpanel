import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { itemQueryContext } from "./query-context";
import { scopeBinding } from "./scope-binding";

/** Read one row as the caller sees it — outside the bound scope it reads as absent. */
export function readRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
  select?: string[],
): Promise<Record<string, unknown> | null> {
  const itemCtx = itemQueryContext(reqCtx, id, {
    ...(select ? { select } : {}),
    ...scopeBinding(resource, reqCtx),
  });
  return runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, itemCtx),
  ) as Promise<Record<string, unknown> | null>;
}
