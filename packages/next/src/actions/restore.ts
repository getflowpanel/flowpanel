import type { MutationContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { FlowpanelOperationDisabledError, runWithRequestContext } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { buildHref } from "../runtime/href";
import { readRow } from "../runtime/read-row";
import { scopeBinding } from "../runtime/scope-binding";
import {
  auditDiff,
  commitEffects,
  guardedRoute,
  lookupResource,
  rowNotFound,
} from "../runtime/write-pipeline";

export function restoreRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string; id: string }, ResourceConfig>(config, {
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      return { spec: { resource, operation: "update" }, target: resource };
    },
    handle: async ({ reqCtx, target: resource, params: { resource: name, id } }) => {
      if (resource.options.update?.disabled) {
        throw new FlowpanelOperationDisabledError("Update is disabled for this resource.");
      }
      const softDelete = resource.options.delete?.softDelete;
      if (!softDelete) return actionFailure("not_found", "resource does not support restore");
      const restore = config.adapter.restore;
      if (typeof restore !== "function") {
        return actionFailure(
          "operation_disabled",
          "the configured adapter does not implement restore",
          { status: 501 },
        );
      }
      const column = String(softDelete);
      const existing = await readRow(config, resource, id, reqCtx);
      if (!existing) return rowNotFound();

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: {},
        id,
        softDelete: { column },
        ...scopeBinding(resource, reqCtx),
      };
      await runWithRequestContext(reqCtx, () => restore(writeTarget(resource), mctx));

      const result = { ok: true, refresh: true } as const;
      await commitEffects(config, reqCtx, result, {
        audit: {
          action: `${name}.restore`,
          resource: name,
          targetId: id,
          diff: () =>
            auditDiff(config, resource, existing, { ...existing, [column]: null }, reqCtx, [
              column,
            ]),
        },
        resourceAudit: resource.options.audit,
        publish: { resourceName: name, pathname: buildHref(config, name) },
      });
      return Response.json({ ok: true });
    },
  });
}
