import type { ResolvedAdminConfig } from "@flowpanel/core";
import { actionFailure } from "../runtime/action-failure";
import {
  auditDiffValue,
  auditReadFilter,
  auditValueText,
  readableDiffFields,
} from "../runtime/audit-view";
import { guardedRoute } from "../runtime/write-pipeline";

const SIDES = new Set(["before", "after"]);

/** GET /api/flowpanel/audit/[id]/value?field=&side= — one whole value an audit event stored. */
export function auditValueRoute(config: ResolvedAdminConfig) {
  return guardedRoute<{ id: string }, undefined>(config, {
    write: false,
    resolve: () => {
      if (!config.auditLog) return actionFailure("not_found", "not found");
      return { spec: { pageAccess: config.audit?.access }, target: undefined };
    },
    handle: async ({ req, reqCtx, params: { id } }) => {
      const store = config.auditLog;
      const url = new URL(req.url);
      const field = url.searchParams.get("field") ?? "";
      const side = url.searchParams.get("side") ?? "";
      if (!SIDES.has(side)) return actionFailure("bad_request", 'side must be "before" or "after"');
      if (!store) return actionFailure("not_found", "not found");
      const entry = await store.entry({ ...(await auditReadFilter(config, reqCtx)), id });
      const resource = entry?.resource ? config.resourcesByName.get(entry.resource) : undefined;
      if (!entry || !resource) return actionFailure("not_found", "not found");
      const readable = await readableDiffFields(config, resource, [entry.diff], reqCtx);
      const value = readable.has(field)
        ? auditDiffValue(entry.diff, field, side === "before" ? "before" : "after")
        : undefined;
      if (value === undefined) return actionFailure("not_found", "not found");
      return Response.json(
        { ok: true, value: auditValueText(value) },
        { headers: { "cache-control": "private, no-store" } },
      );
    },
  });
}
