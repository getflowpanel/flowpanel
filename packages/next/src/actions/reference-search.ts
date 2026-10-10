import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { accessAllows } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import { readRelatedRows } from "../runtime/require-authorized";
import { columnReferences, declaredFormFields } from "../runtime/resolve-form-fields";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";

const REFERENCE_SEARCH_LIMIT = 20;

export function referenceSearchRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string; field: string }, ResourceConfig>(config, {
    write: false,
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      return { spec: { resource, operation: "read" }, target: resource };
    },
    handle: async ({ req, reqCtx, target: resource, params: { field } }) => {
      const fieldDef =
        declaredFormFields(resource, "update")?.find((f) => f.name === field) ??
        declaredFormFields(resource, "create")?.find((f) => f.name === field);
      const ref = fieldDef?.reference ?? columnReferences(resource).get(field)?.reference;
      if (!ref) {
        return actionFailure("not_found", "not a reference field");
      }
      if (!(await accessAllows(resource.options.fieldAccess?.[field]?.read, reqCtx))) {
        return actionFailure("forbidden", "forbidden");
      }

      const target = config.resourcesByName.get(ref.resource);
      if (!target) {
        return actionFailure("not_found", "reference target not found");
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
        return actionFailure("forbidden", "forbidden");
      }

      const options = rows.map((row) => ({
        value: String(row[pk]),
        label: String(row[ref.labelField] ?? row[pk]),
      }));
      return Response.json({ ok: true, options });
    },
  });
}
