import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import { columnDefs } from "../runtime/column-defs";
import { readJsonObject, requestBodyErrorResponse } from "../runtime/request-body";
import { guardedRoute, lookupResource } from "../runtime/write-pipeline";
import { makeActions } from "./resource-actions";

function isEditableColumn(resource: ResourceConfig, field: string): boolean {
  return columnDefs(resource).some((column) => column.field === field && column.editable === true);
}

/** POST /<resource>/<id>/update — one `editable` cell, through the same update path as a form. */
export function inlineUpdateRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ resource: string; id: string }, ResourceConfig>(config, {
    resolve: (params) => {
      const resource = lookupResource(config, params.resource);
      if (resource instanceof Response) return resource;
      return { spec: { resource, operation: "update" }, target: resource };
    },
    handle: async ({ req, reqCtx, target: resource, params: { id } }) => {
      const parsedBody = await readJsonObject(req);
      if (!parsedBody.ok) return requestBodyErrorResponse(parsedBody.reason);
      const { field, value } = parsedBody.value;
      if (typeof field !== "string" || !field) {
        return actionFailure("bad_request", "field is required");
      }
      if (!isEditableColumn(resource, field)) {
        return actionFailure("field_forbidden", `column '${field}' is not editable`);
      }
      await makeActions(config, resource, { reqCtx }).update(
        id,
        { [field]: value },
        { inline: field },
      );
      return Response.json({ ok: true });
    },
  });
}
