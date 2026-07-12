import type { ItemQueryContext, MutationContext, ResolvedAdminConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { buildAuditEvent, maybeEmitAudit } from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher } from "../runtime/publish.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";

export function restoreRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);

  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; id: string }> },
  ): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }

    const softDelete = resource.options.delete?.softDelete;
    if (!softDelete) {
      return Response.json(
        { ok: false, error: "resource does not support restore" },
        { status: 404 },
      );
    }
    if (typeof config.adapter.restore !== "function") {
      return Response.json(
        { ok: false, error: "the configured adapter does not implement restore" },
        { status: 501 },
      );
    }
    const restore = config.adapter.restore;

    const softDeleteColumn = String(softDelete);

    return withGuards(config, req, { resource }, async (reqCtx) => {
      const itemCtx: ItemQueryContext = {
        ...reqCtx,
        db: config.adapter.db,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      const existing = (await runWithRequestContext(reqCtx, () =>
        config.adapter.get(resource.ref, itemCtx),
      )) as Record<string, unknown> | null;
      if (!existing) {
        return Response.json({ ok: false, error: "not found" }, { status: 404 });
      }

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: {},
        id,
        softDelete: { column: softDeleteColumn },
        ...scopeBinding(config, resource, reqCtx),
      };
      await runWithRequestContext(reqCtx, () => restore(resource.ref, mctx));

      await maybeEmitAudit(
        { ok: true },
        config.audit,
        resource.options.audit,
        buildAuditEvent(
          reqCtx,
          {
            action: `${resourceName}.restore`,
            resource: resourceName,
            targetId: id,
            diff: {
              before: { [softDeleteColumn]: existing[softDeleteColumn] },
              after: { [softDeleteColumn]: null },
            },
          },
          config.auth.userId,
        ),
      );

      await applyActionResult(
        { ok: true, refresh: true },
        { resourceName, pathname: buildHref(config, resourceName) },
      );

      return Response.json({ ok: true });
    });
  };
}
