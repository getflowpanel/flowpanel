import type { ResolvedAdminConfig } from "@flowpanel/core";
import { notFoundResponse, roleAllows } from "../runtime/action-helpers";
import { readRelatedRows } from "../runtime/require-authorized";
import { declaredFormFields } from "../runtime/resolve-form-fields";
import { withGuards } from "../runtime/with-guards";

const REFERENCE_SEARCH_LIMIT = 20;

export function referenceSearchRoute(config: ResolvedAdminConfig) {
  return async function GET(
    req: Request,
    ctx: { params: Promise<{ resource: string; field: string }> },
  ): Promise<Response> {
    const { resource: resourceName, field } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }

    return withGuards(
      config,
      req,
      { resource, operation: "read", write: false },
      async (reqCtx) => {
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
          return Response.json({ ok: false, error: "reference target not found" }, { status: 404 });
        }

        const pk = config.adapter.introspect(target.ref).primaryKey;
        const rows = await readRelatedRows(config, target, reqCtx, {
          sort: { field: ref.labelField, dir: "asc" },
          pageSize: REFERENCE_SEARCH_LIMIT,
          search: new URL(req.url).searchParams.get("q") ?? "",
          searchFields: [ref.labelField],
          extraFields: [pk, ref.labelField],
        });
        if (!rows) {
          return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
        }

        const options = rows.map((row) => ({
          value: String(row[pk]),
          label: String(row[ref.labelField] ?? row[pk]),
        }));
        return Response.json({ ok: true, options });
      },
    );
  };
}
