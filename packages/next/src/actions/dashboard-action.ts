import type {
  ActionResult,
  DashboardAction,
  FieldDef,
  IconName,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import {
  actorIdFromSession,
  buildAuditEvent,
  invalidJsonResponse,
  maybeEmitAudit,
  notFoundResponse,
  parseActionInputSchema,
  readActionInput,
  validateActionOutput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { withGuards } from "../runtime/with-guards.js";

/** Wire-safe descriptor for a single `form` field on a dashboard action. */
export interface SerializedDashboardActionField {
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

/** Wire-safe shape of `DashboardAction`. */
export interface SerializedDashboardAction {
  key: string;
  label: string;
  icon?: IconName;
  variant?: "default" | "destructive" | "success";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  hasForm: boolean;
  form?: SerializedDashboardActionField[];
}

function serializeField<Row extends Record<string, unknown>>(
  f: FieldDef<Row>,
): SerializedDashboardActionField {
  const out: SerializedDashboardActionField = { name: f.name };
  if (f.label !== undefined) out.label = f.label;
  if (f.help !== undefined) out.help = f.help;
  if (f.placeholder !== undefined) out.placeholder = f.placeholder;
  if (f.type !== undefined) out.type = f.type;
  if (f.required !== undefined) out.required = f.required;
  if (Array.isArray(f.options)) {
    out.options = f.options.map((o) =>
      typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
    );
  }
  return out;
}

/** Serialize a `DashboardAction` for client consumption. */
export function serializeDashboardAction<Input extends Record<string, unknown>, Output>(
  a: DashboardAction<Input, Output>,
): SerializedDashboardAction {
  const hasForm = Array.isArray(a.form) && a.form.length > 0;
  const out: SerializedDashboardAction = {
    key: a.key,
    label: a.label,
    hasForm,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm && a.form) {
    out.form = a.form.map(serializeField);
  }
  return out;
}

/** URL-safe encoding of a `DashboardConfig.path`. */
export function encodeDashboardPath(path: string): string {
  if (path === "/" || path === "") return "_root_";
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return trimmed.replace(/\//g, "__");
}

/** Reverse of `encodeDashboardPath`. */
export function decodeDashboardPath(encoded: string): string {
  if (encoded === "_root_") return "/";
  return `/${encoded.replace(/__/g, "/")}`;
}

export function dashboardActionRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);

  return async function POST(
    req: Request,
    ctx: { params: Promise<{ dashboard: string; action: string }> },
  ): Promise<Response> {
    const { dashboard: encodedPath, action: actionKey } = await ctx.params;
    const dashboardPath = decodeDashboardPath(encodedPath);
    const dashboard = config.dashboardsByPath.get(dashboardPath);
    if (!dashboard) {
      return notFoundResponse("dashboard", dashboardPath, [...config.dashboardsByPath.keys()]);
    }
    const action = dashboard.actions?.find((a) => a.key === actionKey);
    if (!action) {
      return notFoundResponse(
        "action",
        actionKey,
        (dashboard.actions ?? []).map((a) => a.key),
      );
    }

    return withGuards(
      config,
      req,
      {
        pageRequireRole: dashboard.requireRole,
        actionAccess: action.access,
        actionRequireRole: action.requireRole,
      },
      async (reqCtx) => {
        const body = await readActionInput(req);
        if (!body.ok) return invalidJsonResponse();
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

        const result = validateActionOutput(
          action.outputSchema,
          (await runWithRequestContext(reqCtx, () =>
            action.run(parsedInput.data, actionCtx),
          )) as ActionResult<unknown>,
        );

        await maybeEmitAudit(
          result,
          config.audit,
          undefined, // dashboards have no per-resource audit opt-out
          buildAuditEvent(
            reqCtx,
            {
              action: `dashboard.action.${actionKey}`,
              resource: "dashboard",
              targetId: dashboardPath,
            },
            config.auth.userId,
          ),
        );

        if (result.ok) {
          const dashboardSegments = dashboardPath === "/" ? [] : dashboardPath.slice(1).split("/");
          await applyActionResult(result, {
            pathname: buildHref(config, ...dashboardSegments),
          });
        }

        return Response.json(result);
      },
    );
  };
}
