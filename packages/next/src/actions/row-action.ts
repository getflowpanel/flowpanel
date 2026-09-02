import type {
  ActionResult,
  IconName,
  ItemQueryContext,
  ResolvedAdminConfig,
  RowAction,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import {
  buildActionContext,
  buildAuditEvent,
  computeShallowDiff,
  invalidJsonResponse,
  isAuditActive,
  maybeEmitAudit,
  notFoundResponse,
  readActionInput,
} from "../runtime/action-helpers";
import { parseActionInputSchema, validateActionOutput } from "../runtime/action-schema";
import { applyActionResult } from "../runtime/apply-action-result";
import { buildHref } from "../runtime/href";
import { bindPublisher } from "../runtime/publish";
import { scopeBinding } from "../runtime/scope-binding";
import { withGuards } from "../runtime/with-guards";
import type { ActionFormField } from "./action-form-field";
import { serializeActionForm } from "./serialize-action-field";

/** Wire-safe shape of `RowAction`. */
export interface SerializedRowAction {
  key: string;
  label: string;
  icon?: IconName;
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
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    const actions = resource.options.actions as RowAction<Record<string, unknown>>[] | undefined;
    const action = actions?.find((a) => a.key === actionKey);
    if (!action) {
      return notFoundResponse(
        "action",
        actionKey,
        (actions ?? []).map((a) => a.key),
      );
    }

    return withGuards(
      config,
      req,
      { resource, actionAccess: action.access, actionRequireRole: action.requireRole },
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

        if (action.when) {
          const allowed = await action.when({ ...reqCtx, current: row, input: {} });
          if (!allowed) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
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

        const body = await readActionInput(req);
        if (!body.ok) return invalidJsonResponse(body.reason);
        const input = body.input;
        const parsedInput = await parseActionInputSchema(
          action.form as Parameters<typeof parseActionInputSchema>[0],
          action.inputSchema,
          input,
        );
        if (parsedInput.issues) {
          return Response.json(
            { ok: false, error: "validation failed", issues: parsedInput.issues },
            { status: 422 },
          );
        }

        const actionCtx = buildActionContext(config, reqCtx, action);

        const result = validateActionOutput(
          action.outputSchema,
          (await runWithRequestContext(reqCtx, () =>
            action.run(row, parsedInput.data, actionCtx),
          )) as ActionResult<unknown>,
        );

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
      },
    );
  };
}
