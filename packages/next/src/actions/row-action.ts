import type {
  ActionResult,
  ItemQueryContext,
  ResolvedAdminConfig,
  RowAction,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  buildAuditEvent,
  computeShallowDiff,
  guardActionRole,
  guardResourceAccess,
  isAuditActive,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { scopeBinding } from "../runtime/scope-binding.js";

/**
 * Wire-safe shape of `RowAction`. The `run`, `hidden`, and `disabled` callbacks
 * can't cross the network boundary; strip them server-side and resolve on
 * POST to `/api/flowpanel/<resource>/<id>/actions/<key>`.
 *
 * `confirm` is normalized to its object form so the client doesn't have to
 * branch on a `string | { ... }` union when rendering the confirm dialog.
 */
export interface SerializedRowAction {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "success";
  placement?: "inline" | "menu";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  hasForm: boolean;
}

/**
 * Serialize a `RowAction` for client consumption. Strips runtime callbacks
 * (`run`, `hidden`, `disabled`) and normalizes `confirm` to the object form.
 */
export function serializeRowAction<Row>(a: RowAction<Row>): SerializedRowAction {
  const out: SerializedRowAction = {
    key: a.key,
    label: a.label,
    hasForm: Array.isArray(a.form) && a.form.length > 0,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.placement !== undefined) out.placement = a.placement;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  return out;
}

/**
 * `POST /api/flowpanel/<resource>/<id>/actions/<action>` — runs a per-row
 * action declared in `resource.options.actions`.
 *
 * Flow:
 *
 * 1. Look up resource + action by key. 404 if either is missing.
 * 2. Run resource-level role + scope checks via `requireAuthorized`.
 * 3. Run per-action `requireRole` (narrower than resource-level).
 * 4. Load the row via the adapter. 404 if not found.
 * 5. Re-evaluate `hidden(row, ctx)` server-side (defense in depth). 404 if true.
 * 6. Re-evaluate `disabled(row)` server-side. 409 with the message if truthy.
 * 7. Parse the request body (form-data or JSON) → `input` to the action.
 * 8. Call `action.run(row, input, ctx)`. On success: emit audit, apply
 *    `ActionResult` side effects (publish + revalidate), return the result.
 *
 * Mirrors `drawerActionRoute` so action semantics are identical whether the
 * action is invoked from a drawer or from the trailing menu in a list row.
 *
 * @example Wired into the catch-all handler in `handlers()`:
 * ```ts
 * if (route.length === 4 && route[2] === "actions") {
 *   return postRowAction(req, { params: Promise.resolve({ resource, id, action }) });
 * }
 * ```
 */
export function rowActionRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);

  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; id: string; action: string }> },
  ): Promise<Response> {
    const { resource: resourceName, id, action: actionKey } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    const actions = resource.options.actions as RowAction<Record<string, unknown>>[] | undefined;
    const action = actions?.find((a) => a.key === actionKey);
    if (!action) {
      return Response.json({ ok: false, error: "action not found" }, { status: 404 });
    }

    const reqCtx = await buildRequestContext({ req, config });

    const resourceGuard = guardResourceAccess(config, resource, reqCtx);
    if (resourceGuard) return resourceGuard;
    const roleGuard = guardActionRole(action.requireRole, reqCtx);
    if (roleGuard) return roleGuard;

    // (3) Load row via adapter.
    const itemCtx: ItemQueryContext = {
      ...reqCtx,
      db: config.adapter.db,
      dateRange: { from: new Date(0), to: new Date() },
      searchParams: new URLSearchParams(),
      signal: new AbortController().signal,
      id,
      ...scopeBinding(config, resource, reqCtx),
    };
    const row = (await runWithRequestContext(reqCtx, () =>
      config.adapter.get(resource.ref, itemCtx),
    )) as Record<string, unknown> | null;
    if (!row) {
      return Response.json({ ok: false, error: "not found" }, { status: 404 });
    }

    // (4) Defense-in-depth: re-evaluate hidden / disabled server-side. The UI
    //     already hides / disables matching rows, but a hand-crafted POST
    //     would otherwise bypass these checks.
    if (action.hidden) {
      const isHidden = await action.hidden(row, reqCtx);
      if (isHidden) {
        return Response.json({ ok: false, error: "not found" }, { status: 404 });
      }
    }
    if (action.disabled) {
      const reason = action.disabled(row);
      if (reason) {
        const msg = typeof reason === "string" ? reason : "action disabled for this row";
        return Response.json({ ok: false, error: msg }, { status: 409 });
      }
    }

    const input = await parseActionBody(req);

    // Validate `input` against the action's declared `form` before running.
    // Mirrors the create / edit form pipeline: a hand-crafted POST shouldn't
    // reach `action.run` with input the form would have rejected.
    const inputIssues = validateActionInput(
      action.form as Parameters<typeof validateActionInput>[0],
      input,
    );
    if (inputIssues) {
      return Response.json(
        { ok: false, error: "validation failed", issues: inputIssues },
        { status: 422 },
      );
    }

    const actionCtx = {
      ...reqCtx,
      db: config.adapter.db,
      publish: async (channel: string, payload?: unknown) => {
        await publish(channel, payload);
      },
    };

    try {
      const result = (await runWithRequestContext(reqCtx, () =>
        action.run(row, input, actionCtx),
      )) as ActionResult;

      // Auto-audit diff: re-fetch the row after a successful mutation and
      // diff it against the `row` snapshot we already loaded. Skipped
      // entirely when no audit sink is active (or the resource opted out)
      // so we never pay for the extra read when nobody is listening. A
      // re-fetch failure (e.g. the action deleted the row) degrades to a
      // delete diff rather than throwing.
      let diff: ReturnType<typeof computeShallowDiff> | undefined;
      if (result.ok && isAuditActive(config.audit, resource.options.audit)) {
        let after: Record<string, unknown> | null = null;
        try {
          after = (await runWithRequestContext(reqCtx, () =>
            config.adapter.get(resource.ref, itemCtx),
          )) as Record<string, unknown> | null;
        } catch {
          after = null;
        }
        diff = computeShallowDiff(row, after);
      }

      await maybeEmitAudit(
        result,
        config.audit,
        resource.options.audit,
        buildAuditEvent(reqCtx, {
          action: `${resourceName}.action.${actionKey}`,
          resource: resourceName,
          targetId: id,
          ...(diff !== undefined ? { diff } : {}),
        }),
      );

      if (result.ok) {
        await applyActionResult(result, {
          resourceName,
          pathname: buildHref(config, resourceName),
        });
      }

      return Response.json(result);
    } catch (err) {
      return Response.json({ ok: false, error: safeErrorMessage(err) }, { status: 500 });
    }
  };
}
