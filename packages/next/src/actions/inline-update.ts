import type { ItemQueryContext, MutationContext, ResolvedAdminConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import {
  buildAuditEvent,
  guardResourceAccess,
  maybeEmitAudit,
  safeErrorMessage,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { scopeBinding } from "../runtime/scope-binding.js";

/**
 * `POST /api/flowpanel/<resource>/<id>/update` — partial update of a single
 * row, used by the inline-edit table cell to save a single field without
 * navigating to the edit page.
 *
 * Body: JSON `{ field: string, value: unknown }`. The handler validates
 * `field` is editable (declared with `ColumnDef.editable: true`), then
 * calls `adapter.update(ref, { id, input: { [field]: value } })`.
 *
 * Validation reuses the resource's `update` Zod schema via
 * `inferSchema(ref).update.pick({ [field]: true })` — so the cell-level
 * write goes through the same input rules as the full edit form.
 *
 * Audit + realtime publish identical to the regular Server Action path.
 */
export function inlineUpdateRoute(config: ResolvedAdminConfig) {
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

    let body: { field?: unknown; value?: unknown };
    try {
      body = (await req.json()) as { field?: unknown; value?: unknown };
    } catch {
      return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
    }

    if (typeof body.field !== "string" || !body.field) {
      return Response.json({ ok: false, error: "field is required" }, { status: 400 });
    }
    const field = body.field;
    const value = body.value;

    // Editable allowlist: walk resource.options.columns and find the
    // matching ColumnDef. Reject if the column doesn't exist or isn't
    // marked editable. This is defense-in-depth — the UI already only
    // surfaces inputs for editable columns, but a hand-crafted POST would
    // otherwise bypass.
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

    // Validate the single field against the resource's `update` schema — the
    // same Zod surface the full edit form goes through. Without this, a
    // hand-crafted POST could write any value to an editable column (the
    // editable allowlist only gates *which* column, not its value).
    //
    // `inferSchema` may not surface a usable `update` schema (custom adapters,
    // or a resource with no inferable shape); in that case we skip validation
    // rather than crash — the editable allowlist is still enforced above.
    let nextValue = value;
    const updateSchema = config.adapter.inferSchema?.(resource.ref)?.update as
      | { pick?: (mask: Record<string, true>) => { safeParse: (v: unknown) => unknown } }
      | { safeParse?: (v: unknown) => unknown }
      | undefined;
    if (updateSchema && typeof updateSchema === "object") {
      const picker = (updateSchema as { pick?: (m: Record<string, true>) => unknown }).pick;
      const target =
        typeof picker === "function" ? picker.call(updateSchema, { [field]: true }) : updateSchema;
      const safeParse = (target as { safeParse?: (v: unknown) => unknown } | undefined)?.safeParse;
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
          return Response.json({ ok: false, error: "validation failed", issues }, { status: 422 });
        }
        if (parsed.data && field in parsed.data) nextValue = parsed.data[field];
      }
    }

    const reqCtx = await buildRequestContext({ req, config });
    const resourceGuard = guardResourceAccess(config, resource, reqCtx);
    if (resourceGuard) return resourceGuard;

    // Confirm the row exists before we attempt the update. Lets us return
    // a clean 404 instead of an opaque adapter error.
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
      input: { [field]: nextValue } as Partial<Record<string, unknown>>,
      id,
      ...scopeBinding(config, resource, reqCtx),
    };
    try {
      await runWithRequestContext(reqCtx, () => config.adapter.update(resource.ref, mctx));
    } catch (err) {
      return Response.json({ ok: false, error: safeErrorMessage(err) }, { status: 500 });
    }

    await maybeEmitAudit(
      { ok: true },
      config.audit,
      resource.options.audit,
      buildAuditEvent(reqCtx, {
        action: `${resourceName}.inline-update`,
        resource: resourceName,
        targetId: id,
        diff: { before: { [field]: existing[field] }, after: { [field]: nextValue } },
      }),
    );

    await applyActionResult(
      { ok: true, refresh: true },
      { resourceName, pathname: buildHref(config, resourceName) },
    );

    return Response.json({ ok: true });
  };
}
