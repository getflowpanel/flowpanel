import type { ActionResult, DashboardAction, ResolvedAdminConfig } from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  buildAuditEvent,
  guardActionRole,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";

/**
 * Wire-safe descriptor for a single `form` field on a dashboard action.
 *
 * `FieldDef` carries non-serializable members (`validate`, function-shaped
 * `options`, `defaultValue`, `transform`, etc.). We project to the subset
 * that the client renderer actually needs. Function-shaped `options` are
 * resolved at serialize time; literal `string[]` shorthand is normalized
 * into `{label, value}` pairs the same way `FilterBar` expects.
 */
export interface SerializedDashboardActionField {
  name: string;
  label?: string;
  help?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
}

/**
 * Wire-safe shape of `DashboardAction`. Strips the runtime `run` callback,
 * normalizes `confirm` to its object form, and exposes the form schema
 * for client-side rendering.
 */
export interface SerializedDashboardAction {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive" | "success";
  confirm?: { title: string; description?: string; confirmLabel?: string };
  hasForm: boolean;
  form?: SerializedDashboardActionField[];
}

function serializeField(
  f: NonNullable<DashboardAction["form"]>[number],
): SerializedDashboardActionField {
  const out: SerializedDashboardActionField = { name: f.name };
  if (f.label !== undefined) out.label = f.label;
  if (f.help !== undefined) out.help = f.help;
  if (f.placeholder !== undefined) out.placeholder = f.placeholder;
  if (f.type !== undefined) out.type = f.type;
  if (f.required !== undefined) out.required = f.required;
  // Function-shaped options can't cross the wire; literal arrays do. We
  // normalize string shorthand here so the client renderer doesn't need
  // a branch.
  if (Array.isArray(f.options)) {
    out.options = f.options.map((o) =>
      typeof o === "string" ? { label: o, value: o } : { label: o.label, value: String(o.value) },
    );
  }
  return out;
}

/**
 * Serialize a `DashboardAction` for client consumption. Strips `run` and
 * `requireRole` (the latter is enforced server-side; leaking role names to
 * the client provides no UX value).
 */
export function serializeDashboardAction(a: DashboardAction): SerializedDashboardAction {
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

/**
 * URL-safe encoding of a `DashboardConfig.path`.
 *
 * The dashboard path itself contains `/` (e.g. `/team/ops`), which would
 * collide with the route segments of the catch-all handler. We map:
 *
 * - `"/"`        → `"_root_"`      (the root dashboard)
 * - `"/x"`       → `"x"`           (leading slash stripped)
 * - `"/x/y"`     → `"x__y"`        (interior `/` → `__`)
 *
 * The chosen sentinels (`_root_`, `__`) are intentionally not URL-encoded
 * representations so they survive copy-paste into a browser address bar.
 * They also can't collide with a slug containing only `[a-zA-Z0-9-]`,
 * which is the convention for dashboard paths in user code.
 */
export function encodeDashboardPath(path: string): string {
  if (path === "/" || path === "") return "_root_";
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return trimmed.replace(/\//g, "__");
}

/**
 * Reverse of `encodeDashboardPath`. Resolve the wire segment back to the
 * canonical `DashboardConfig.path`.
 */
export function decodeDashboardPath(encoded: string): string {
  if (encoded === "_root_") return "/";
  return `/${encoded.replace(/__/g, "/")}`;
}

/**
 * `POST /api/flowpanel/dashboards/<encoded-path>/actions/<key>` — runs a
 * dashboard-level action declared in `dashboard.actions`.
 *
 * Path encoding: see `encodeDashboardPath`. The root dashboard (`path: "/"`)
 * is reachable at `/api/flowpanel/dashboards/_root_/actions/<key>`; a nested
 * `/team/ops` dashboard at `/api/flowpanel/dashboards/team__ops/actions/<key>`.
 *
 * Flow mirrors `rowActionRoute` minus the row lookup and `hidden/disabled`
 * row-bound checks (dashboards aren't bound to a row):
 *
 * 1. Decode the path segment, look up the dashboard + action by key.
 *    404 if either is missing.
 * 2. Build the request context (auth, scope, rate limit).
 * 3. Per-action `requireRole` (narrower than the admin's `auth.requireRole`,
 *    which `buildRequestContext` already enforced).
 * 4. Parse the body (form-data or JSON) → `input`.
 * 5. Call `action.run(input, ctx)`. On success: emit audit, apply
 *    `ActionResult` side effects (publish + revalidate), return the result.
 *
 * Revalidation targets the dashboard's own URL — not a resource list — since
 * a dashboard action's effects (e.g. "trigger scraper") most plausibly
 * change the data the dashboard's widgets read.
 */
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
      return Response.json({ ok: false, error: "dashboard not found" }, { status: 404 });
    }
    const action = dashboard.actions?.find((a) => a.key === actionKey);
    if (!action) {
      return Response.json({ ok: false, error: "action not found" }, { status: 404 });
    }

    const reqCtx = await buildRequestContext({ req, config });

    // Dashboard-level gate: mirror the page render's `dashboard.requireRole`
    // check so the action can't bypass what the page itself enforces.
    // `checkRequireRole` (not `guardActionRole`) because a dashboard's
    // `requireRole` also accepts a session predicate, which is wider than the
    // per-action policy.
    if (dashboard.requireRole !== undefined) {
      try {
        checkRequireRole(dashboard.requireRole, reqCtx.role, reqCtx.session);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "forbidden";
        return Response.json({ ok: false, error: msg }, { status: 403 });
      }
    }

    const roleGuard = guardActionRole(action.requireRole, reqCtx);
    if (roleGuard) return roleGuard;

    const input = await parseActionBody(req);

    // Validate `input` against the action's declared `form` before running —
    // same defense-in-depth as the row / bulk action paths.
    const inputIssues = validateActionInput(action.form, input);
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
        action.run(input, actionCtx),
      )) as ActionResult;

      // Auto-emit audit on success. Dashboard actions opt out globally by
      // not configuring `config.audit`; there's no per-dashboard knob since
      // a dashboard isn't a resource. The action name namespaces under
      // `dashboard.action.<key>` and uses the dashboard's path as targetId
      // to make audit rows greppable.
      await maybeEmitAudit(
        result,
        config.audit,
        undefined, // dashboards have no per-resource audit opt-out
        buildAuditEvent(reqCtx, {
          action: `dashboard.action.${actionKey}`,
          resource: "dashboard",
          targetId: dashboardPath,
        }),
      );

      if (result.ok) {
        // Revalidate the dashboard URL itself so widgets re-fetch. We don't
        // pass `resourceName` because there isn't one to publish on.
        const dashboardSegments = dashboardPath === "/" ? [] : dashboardPath.slice(1).split("/");
        await applyActionResult(result, {
          pathname: buildHref(config, ...dashboardSegments),
        });
      }

      return Response.json(result);
    } catch (err) {
      return Response.json({ ok: false, error: safeErrorMessage(err) }, { status: 500 });
    }
  };
}
