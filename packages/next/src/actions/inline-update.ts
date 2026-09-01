import type { ItemQueryContext, MutationContext, ResolvedAdminConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { buildAuditEvent, maybeEmitAudit, notFoundResponse } from "../runtime/action-helpers";
import { applyActionResult } from "../runtime/apply-action-result";
import { buildHref } from "../runtime/href";
import { bindPublisher } from "../runtime/publish";
import { readJsonObject, requestBodyErrorResponse } from "../runtime/request-body";
import { declaredFormFields } from "../runtime/resolve-form-fields";
import { scopeBinding } from "../runtime/scope-binding";
import { withGuards } from "../runtime/with-guards";
import { assertResourceWritableInput, schemasFor } from "./field-pipeline";

export function inlineUpdateRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);

  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; id: string }> },
  ): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    if (resource.options.update?.disabled) {
      return Response.json({ ok: false, error: "editing is disabled" }, { status: 403 });
    }

    return withGuards(config, req, { resource, operation: "update" }, async (reqCtx) => {
      const parsedBody = await readJsonObject(req);
      if (!parsedBody.ok) return requestBodyErrorResponse(parsedBody.reason);
      const body = parsedBody.value as { field?: unknown; value?: unknown };

      if (typeof body.field !== "string" || !body.field) {
        return Response.json({ ok: false, error: "field is required" }, { status: 400 });
      }
      const field = body.field;
      const value = body.value;

      const isEditable = (resource.options.columns ?? []).some((c) => {
        if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") return false;
        const def = c as { field?: string; editable?: boolean };
        return def.field === field && def.editable === true;
      });
      if (!isEditable) {
        return Response.json(
          { ok: false, error: `column '${field}' is not editable` },
          { status: 403 },
        );
      }

      const formFields = declaredFormFields(resource, "update");
      const updateFields =
        formFields && !formFields.some((f) => f.name === field)
          ? [...formFields, { name: field }]
          : formFields;

      let nextValue = value;
      // The same schema resolution as form edits and JSON PATCH: the resource's
      // declared `schema` wins over the adapter-inferred one.
      const updateSchema = schemasFor(config, resource).update as
        | { pick?: (mask: Record<string, true>) => { safeParse: (v: unknown) => unknown } }
        | { safeParse?: (v: unknown) => unknown }
        | undefined;
      if (updateSchema && typeof updateSchema === "object") {
        const picker = (updateSchema as { pick?: (m: Record<string, true>) => unknown }).pick;
        const target =
          typeof picker === "function"
            ? picker.call(updateSchema, { [field]: true })
            : updateSchema;
        const safeParse = (target as { safeParse?: (v: unknown) => unknown } | undefined)
          ?.safeParse;
        if (typeof safeParse === "function") {
          const parsed = safeParse.call(target, { [field]: value }) as {
            success: boolean;
            data?: Record<string, unknown>;
            error?: { issues: { path: PropertyKey[]; message: string }[] };
          };
          if (!parsed.success) {
            const issues = (parsed.error?.issues ?? []).map((i) => ({
              path: i.path.map((p) => (typeof p === "symbol" ? p.toString() : p)),
              message: i.message,
            }));
            return Response.json(
              { ok: false, error: "validation failed", issues },
              { status: 422 },
            );
          }
          if (parsed.data && field in parsed.data) nextValue = parsed.data[field];
        }
      }

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

      await assertResourceWritableInput(
        resource,
        updateFields,
        { [field]: nextValue },
        existing,
        reqCtx,
      );

      const mctx: MutationContext<Record<string, unknown>> = {
        ...reqCtx,
        db: config.adapter.db,
        input: { [field]: nextValue } as Partial<Record<string, unknown>>,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      await runWithRequestContext(reqCtx, () => config.adapter.update(resource.ref, mctx));

      await maybeEmitAudit(
        { ok: true },
        config.audit,
        resource.options.audit,
        buildAuditEvent(
          reqCtx,
          {
            action: `${resourceName}.inline-update`,
            resource: resourceName,
            targetId: id,
            diff: { before: { [field]: existing[field] }, after: { [field]: nextValue } },
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
