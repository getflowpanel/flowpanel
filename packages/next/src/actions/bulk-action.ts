import type { ActionResult, BulkAction, ResolvedAdminConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  actorIdFromSession,
  buildAuditEvent,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { withGuards } from "../runtime/with-guards.js";
import type { ActionFormField } from "./action-form-field.js";
import { serializeActionForm } from "./serialize-action-field.js";

/** Wire-safe shape of `BulkAction`. */
export interface SerializedBulkAction {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive";
  confirm?: { title: string; description?: string };
  hasForm: boolean;
  form?: ActionFormField[];
}

/** Serialize a `BulkAction` for client consumption. */
export function serializeBulkAction<Row>(a: BulkAction<Row>): SerializedBulkAction {
  const hasForm = Array.isArray(a.form) && a.form.length > 0;
  const out: SerializedBulkAction = {
    key: a.key,
    label: a.label,
    hasForm,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm) {
    const serialized = serializeActionForm(a.form as Parameters<typeof serializeActionForm>[0]);
    if (serialized) out.form = serialized;
  }
  return out;
}

/** Parses the incoming request body for the array of selected IDs. */
async function parseBulkBody(req: Request): Promise<{ ids: string[]; input: unknown } | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return null;
    }
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as { ids?: unknown; input?: unknown };
    if (!Array.isArray(obj.ids)) return null;
    const ids = obj.ids.filter((v): v is string => typeof v === "string");
    if (ids.length === 0) return null;
    return { ids, input: obj.input ?? {} };
  }
  const cloned = req.clone();
  let form: FormData;
  try {
    form = await cloned.formData();
  } catch {
    return null;
  }
  const raw = form.getAll("ids");
  const ids: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    if (v.includes(","))
      ids.push(
        ...v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    else if (v) ids.push(v);
  }
  if (ids.length === 0) return null;
  const input = await parseActionBody(req);
  delete (input as Record<string, unknown>).ids;
  return { ids, input };
}

/** Hard cap on the number of ids a single bulk action may target. */
const MAX_BULK = 1000;

export function bulkActionRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);

  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; action: string }> },
  ): Promise<Response> {
    const { resource: resourceName, action: actionKey } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    const actions = resource.options.bulkActions as
      | BulkAction<Record<string, unknown>>[]
      | undefined;
    const action = actions?.find((a) => a.key === actionKey);
    if (!action) {
      return Response.json({ ok: false, error: "action not found" }, { status: 404 });
    }

    return withGuards(
      config,
      req,
      { resource, actionRequireRole: action.requireRole },
      async (reqCtx) => {
        const body = await parseBulkBody(req);
        if (!body) {
          return Response.json(
            { ok: false, error: "ids must be a non-empty array of strings" },
            { status: 400 },
          );
        }
        if (body.ids.length > MAX_BULK) {
          return Response.json(
            { ok: false, error: `too many ids (max ${MAX_BULK})` },
            { status: 422 },
          );
        }

        const inputIssues = validateActionInput(
          action.form as Parameters<typeof validateActionInput>[0],
          body.input,
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
            action.run(body.ids, body.input, actionCtx),
          )) as ActionResult;

          const targetId = body.ids.slice(0, 10).join(",") + (body.ids.length > 10 ? "…" : "");
          await maybeEmitAudit(
            result,
            config.audit,
            resource.options.audit,
            buildAuditEvent(reqCtx, {
              action: `${resourceName}.bulk.${actionKey}`,
              resource: resourceName,
              targetId,
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
      },
    );
  };
}
