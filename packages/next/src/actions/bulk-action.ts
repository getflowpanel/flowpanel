import type {
  ActionResult,
  BulkAction,
  IconName,
  ItemQueryContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { FlowpanelNotFoundError, runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  actorIdFromSession,
  buildAuditEvent,
  invalidJsonResponse,
  maybeEmitAudit,
  notFoundResponse,
} from "../runtime/action-helpers.js";
import { parseActionInputSchema, validateActionOutput } from "../runtime/action-schema.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";
import type { ActionFormField } from "./action-form-field.js";
import { serializeActionForm } from "./serialize-action-field.js";

/** Wire-safe shape of `BulkAction`. */
export interface SerializedBulkAction {
  key: string;
  label: string;
  icon?: IconName;
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

type BulkBody =
  | { ok: true; ids: string[]; input: Record<string, unknown> }
  | { ok: false; reason: "invalid-json" | "ids" | "input" };

/** Parses the incoming request body for the array of selected IDs. */
async function parseBulkBody(req: Request): Promise<BulkBody> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return { ok: false, reason: "invalid-json" };
    }
    if (!payload || typeof payload !== "object") return { ok: false, reason: "ids" };
    const obj = payload as { ids?: unknown; input?: unknown };
    if (!Array.isArray(obj.ids)) return { ok: false, reason: "ids" };
    const ids = obj.ids.filter((v): v is string => typeof v === "string");
    if (ids.length === 0) return { ok: false, reason: "ids" };
    const input = obj.input ?? {};
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, reason: "input" };
    }
    return { ok: true, ids, input: input as Record<string, unknown> };
  }
  const cloned = req.clone();
  let form: FormData;
  try {
    form = await cloned.formData();
  } catch {
    return { ok: false, reason: "ids" };
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
  if (ids.length === 0) return { ok: false, reason: "ids" };
  const input = await parseActionBody(req);
  delete (input as Record<string, unknown>).ids;
  return { ok: true, ids, input };
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
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    const actions = resource.options.bulkActions as
      | BulkAction<Record<string, unknown>>[]
      | undefined;
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
        const body = await parseBulkBody(req);
        if (!body.ok) {
          if (body.reason === "invalid-json") return invalidJsonResponse();
          if (body.reason === "input") {
            return Response.json({ ok: false, error: "input must be an object" }, { status: 400 });
          }
          return Response.json(
            { ok: false, error: "ids must be a non-empty array of strings" },
            { status: 400 },
          );
        }
        const ids = [...new Set(body.ids)];
        const max = action.max ?? MAX_BULK;
        if (ids.length > max) {
          return Response.json({ ok: false, error: `too many ids (max ${max})` }, { status: 422 });
        }

        const parsedInput = await parseActionInputSchema(
          action.form as Parameters<typeof parseActionInputSchema>[0],
          action.inputSchema,
          body.input,
        );
        if (parsedInput.issues) {
          return Response.json(
            { ok: false, error: "validation failed", issues: parsedInput.issues },
            { status: 422 },
          );
        }

        const actionCtx = {
          ...reqCtx,
          db: config.adapter.db,
          ...(action.unsafe?.includes("db") ? { unsafe: { db: config.adapter.db } } : {}),
          actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
          publish: async (channel: string, payload?: unknown) => {
            await publish(channel, payload);
          },
        };

        await Promise.all(
          ids.map(async (id) => {
            const itemCtx: ItemQueryContext = {
              ...reqCtx,
              db: config.adapter.db,
              dateRange: { from: new Date(0), to: new Date() },
              searchParams: new URLSearchParams(),
              signal: new AbortController().signal,
              id,
              ...scopeBinding(config, resource, reqCtx),
            };
            const row = await runWithRequestContext(reqCtx, () =>
              config.adapter.get(resource.ref, itemCtx),
            );
            if (!row) throw new FlowpanelNotFoundError();
          }),
        );

        const result = validateActionOutput(
          action.outputSchema,
          (await runWithRequestContext(reqCtx, () =>
            action.run(ids, parsedInput.data, actionCtx),
          )) as ActionResult<unknown>,
        );

        const targetId = ids.slice(0, 10).join(",") + (ids.length > 10 ? "…" : "");
        await maybeEmitAudit(
          result,
          config.audit,
          resource.options.audit,
          buildAuditEvent(
            reqCtx,
            {
              action: `${resourceName}.bulk.${actionKey}`,
              resource: resourceName,
              targetId,
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
