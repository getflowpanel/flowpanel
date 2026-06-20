import type { ListQueryContext, ResolvedAdminConfig } from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { roleAllows } from "../runtime/action-helpers.js";
import { declaredFormFields } from "../runtime/resolve-form-fields.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";

const REFERENCE_SEARCH_LIMIT = 20;

export function referenceSearchRoute(config: ResolvedAdminConfig) {
  return async function GET(
    req: Request,
    ctx: { params: Promise<{ resource: string; field: string }> },
  ): Promise<Response> {
    const { resource: resourceName, field } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }

    return withGuards(config, req, { resource, write: false }, async (reqCtx) => {
      const fieldDef =
        declaredFormFields(resource, "update")?.find((f) => f.name === field) ??
        declaredFormFields(resource, "create")?.find((f) => f.name === field);
      const ref = fieldDef?.reference;
      if (!ref) {
        return Response.json({ ok: false, error: "not a reference field" }, { status: 404 });
      }
      if (!roleAllows(fieldDef.requireRole, reqCtx)) {
        return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const target = config.resourcesByName.get(ref.resource);
      if (!target) {
        return Response.json({ ok: true, options: [] });
      }
      if (target.options.requireRole !== undefined) {
        try {
          checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
        } catch {
          return Response.json({ ok: true, options: [] });
        }
      }

      const search = new URL(req.url).searchParams.get("q") ?? "";
      const pk = config.adapter.introspect(target.ref).primaryKey;
      const listCtx: ListQueryContext<unknown> = {
        ...reqCtx,
        db: config.adapter.db,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        filters: {},
        sort: { field: ref.labelField, dir: "asc" } as ListQueryContext<unknown>["sort"],
        page: 1,
        pageSize: REFERENCE_SEARCH_LIMIT,
        search,
        searchFields: [ref.labelField],
        ...scopeBinding(config, target, reqCtx),
      };

      const result = await runWithRequestContext(reqCtx, () =>
        config.adapter.list(target.ref, listCtx),
      );
      const options = (result.rows as Record<string, unknown>[]).map((row) => ({
        value: String(row[pk]),
        label: String(row[ref.labelField] ?? row[pk]),
      }));
      return Response.json({ ok: true, options });
    });
  };
}
