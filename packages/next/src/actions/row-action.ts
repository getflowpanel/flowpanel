import type {
  ActionResult,
  ItemQueryContext,
  ResolvedAdminConfig,
  RowAction,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  actorIdFromSession,
  buildAuditEvent,
  computeShallowDiff,
  isAuditActive,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";
import type { ActionFormField } from "./action-form-field.js";
import { serializeActionForm } from "./serialize-action-field.js";

/** Wire-safe shape of `RowAction`. */
export interface SerializedRowAction {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "success";
  placement?: "inline" | "menu";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  hasForm: boolean;
  form?: ActionFormField[];
}

/** Serialize a `RowAction` for client consumption. */
export function serializeRowAction<Row>(a: RowAction<Row>): SerializedRowAction {
  const hasForm = Array.isArray(a.form) && a.form.length > 0;
  const out: SerializedRowAction = {
    key: a.key,
    label: a.label,
    hasForm,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.placement !== undefined) out.placement = a.placement;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm) {
    const serialized = serializeActionForm(a.form as Parameters<typeof serializeActionForm>[0]);
    if (serialized) out.form = serialized;
  }
  return out;
}

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

    return withGuards(
      config,
      req,
      { resource, actionRequireRole: action.requireRole },
      async (reqCtx) => {
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

        const inputIssues = await validateActionInput(
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
          actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
          publish: async (channel: string, payload?: unknown) => {
            await publish(channel, payload);
          },
        };

        try {
          const result = (await runWithRequestContext(reqCtx, () =>
            action.run(row, input, actionCtx),
          )) as ActionResult;

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
            buildAuditEvent(
              reqCtx,
              {
                action: `${resourceName}.action.${actionKey}`,
                resource: resourceName,
                targetId: id,
                ...(diff !== undefined ? { diff } : {}),
              },
              config.auth.userId,
            ),
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
      },
    );
  };
}
