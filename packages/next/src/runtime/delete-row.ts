import type {
  MutationContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { scopeBinding } from "./scope-binding";

/** The single delete path: honours the resource's soft-delete column and the request's bound scope. */
export async function deleteRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  id: string,
  reqCtx: RequestContext,
): Promise<void> {
  const softDelete = resource.options.delete?.softDelete;
  const mctx: MutationContext<Record<string, unknown>> = {
    ...reqCtx,
    db: config.adapter.db,
    input: {},
    id,
    ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
    ...scopeBinding(config, resource, reqCtx),
  };
  await runWithRequestContext(reqCtx, () => config.adapter.delete(resource.ref, mctx));
}
