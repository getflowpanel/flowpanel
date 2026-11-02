import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { softDeleteColumn } from "./deleted-row";
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

/** The row a write may act on: a soft-deleted row reads as absent, so only Restore reaches it. */
export async function readLiveRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
): Promise<Record<string, unknown> | null> {
  const row = await readRow(config, resource, id, reqCtx);
  const column = softDeleteColumn(resource);
  return row && column !== null && row[column] != null ? null : row;
}
