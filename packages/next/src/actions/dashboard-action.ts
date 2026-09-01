import type {
  ActionResult,
  DashboardAction,
  FieldDef,
  IconName,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import {
  buildActionContext,
  buildAuditEvent,
  invalidJsonResponse,
  maybeEmitAudit,
  notFoundResponse,
  readActionInput,
} from "../runtime/action-helpers";
import { parseActionInputSchema, validateActionOutput } from "../runtime/action-schema";
import { applyActionResult } from "../runtime/apply-action-result";
import { buildHref } from "../runtime/href";
import { bindPublisher } from "../runtime/publish";
import { withGuards } from "../runtime/with-guards";
import type { ActionFormField } from "./action-form-field";
import { serializeActionFormField } from "./serialize-action-field";

/** Wire-safe descriptor for a single `form` field on a dashboard action. */
export type SerializedDashboardActionField = ActionFormField;

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
    out.form = (a.form as FieldDef<Record<string, unknown>>[]).map(serializeActionFormField);
  }
  return out;
}

/**
 * URL-safe encoding of a `DashboardConfig.path`. Underscores are escaped
 * before slashes so paths containing literal underscores round-trip.
 */
export function encodeDashboardPath(path: string): string {
  if (path === "/" || path === "") return "_root_";
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return trimmed.replace(/_/g, "_5f").replace(/\//g, "_2f");
}

/** Reverse of `encodeDashboardPath`. */
export function decodeDashboardPath(encoded: string): string {
  if (encoded === "_root_") return "/";
  return `/${encoded.replace(/_2f/g, "/").replace(/_5f/g, "_")}`;
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
        if (!body.ok) return invalidJsonResponse(body.reason);
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

        const actionCtx = buildActionContext(config, reqCtx, action);

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
