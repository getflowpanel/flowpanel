import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { mergeLabels, resolveFormatting } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { actionFailure } from "../runtime/action-failure";
import { coerceRowByColumns } from "../runtime/coerce-values";
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
      // A timestamp arrives as the `datetime-local` text the cell showed, on the admin's clock, as a form posts it.
      const coerced = coerceRowByColumns(
        config.adapter.introspect(writeTarget(resource)).columns.filter((c) => c.type === "date"),
        { [field]: value },
        mergeLabels(config.labels),
        resolveFormatting(config.formatting).timeZone,
      );
      await makeActions(config, resource, { reqCtx }).update(id, coerced.values, {
        inline: field,
        decodeErrors: coerced.fieldErrors,
      });
      return Response.json({ ok: true });
    },
  });
}
