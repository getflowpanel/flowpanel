import type {
  ActionEmphasis,
  DashboardAction,
  FieldDef,
  IconName,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { dashboardActionAudit } from "@flowpanel/core/internal";
import { notFoundResponse } from "../runtime/action-helpers";
import { buildHref } from "../runtime/href";
import { warnOnce } from "../runtime/widget-reads";
import {
  guardedRoute,
  lookupAction,
  readActionBody,
  runDeclaredAction,
} from "../runtime/write-pipeline";
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
  emphasis?: ActionEmphasis;
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
  if (a.emphasis !== undefined) out.emphasis = a.emphasis;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  if (hasForm && a.form) {
    out.form = (a.form as FieldDef<Record<string, unknown>>[]).map(serializeActionFormField);
  }
  return out;
}

/** A screen has one primary action; name the extra ones once in development. */
export function warnManyPrimary(actions: SerializedDashboardAction[], where: string): void {
  const primary = actions.filter((a) => a.emphasis === "primary").map((a) => a.label);
  if (primary.length < 2) return;
  warnOnce(
    `primary:${where}`,
    `${where} has ${primary.length} primary actions (${primary.join(", ")}); ` +
      `keep one and let the rest be secondary.`,
  );
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
  return guardedRoute<
    { dashboard: string; action: string },
    { path: string; action: DashboardAction<Record<string, unknown>, unknown> }
  >(config, {
    resolve: (params) => {
      const path = decodeDashboardPath(params.dashboard);
      const dashboard = config.dashboardsByPath.get(path);
      if (!dashboard) {
        return notFoundResponse("dashboard", path, [...config.dashboardsByPath.keys()]);
      }
      const action = lookupAction(dashboard.actions, params.action);
      if (action instanceof Response) return action;
      return {
        spec: { pageAccess: dashboard.access, actionAccess: action.access },
        target: { path, action },
      };
    },
    handle: async ({ req, reqCtx, target: { path, action } }) => {
      const input = await readActionBody(req);
      if (input instanceof Response) return input;
      const segments = path === "/" ? [] : path.slice(1).split("/");
      return runDeclaredAction(
        config,
        reqCtx,
        action,
        input,
        (parsed, actionCtx) => action.run(parsed, actionCtx),
        {
          audit: { ...dashboardActionAudit(action.key), targetId: path },
          publish: { pathname: buildHref(config, ...segments) },
        },
      );
    },
  });
}
