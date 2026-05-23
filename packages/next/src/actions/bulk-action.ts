import type { ActionResult, BulkAction, ResolvedAdminConfig } from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body.js";
import {
  buildAuditEvent,
  guardActionRole,
  guardResourceAccess,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { buildRequestContext } from "../runtime/request-setup.js";

/**
 * Wire-safe shape of `BulkAction`. The `run` callback isn't crossable across
 * the network boundary; strip it server-side and resolve on
 * `POST /api/flowpanel/<resource>/bulk-actions/<key>`.
 *
 * `confirm` is normalized to its object form so the client doesn't have to
 * branch on `string | { ... }`.
 */
export interface SerializedBulkAction {
  key: string;
  label: string;
  icon?: string;
  variant?: "default" | "destructive";
  confirm?: { title: string; description?: string };
  hasForm: boolean;
}

/**
 * Serialize a `BulkAction` for client consumption. Strips the runtime `run`
 * callback and normalizes `confirm`.
 */
export function serializeBulkAction<Row>(a: BulkAction<Row>): SerializedBulkAction {
  const out: SerializedBulkAction = {
    key: a.key,
    label: a.label,
    hasForm: Array.isArray(a.form) && a.form.length > 0,
  };
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.confirm !== undefined) {
    out.confirm = typeof a.confirm === "string" ? { title: a.confirm } : a.confirm;
  }
  return out;
}

/**
 * Parses the incoming request body for the array of selected IDs.
 *
 * Accepts:
 *   - JSON: `{ ids: ["a", "b"], input?: {...} }` (canonical)
 *   - FormData: `ids` (repeated or comma-separated) + arbitrary fields → `input`
 *
 * Returns `null` if `ids` is missing, not an array, or empty.
 */
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
  // form-data fallback — `ids` may be repeated, or a single comma-separated string.
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
  // Everything else in the form becomes `input`.
  const input = await parseActionBody(req);
  delete (input as Record<string, unknown>).ids;
  return { ids, input };
}

/**
 * `POST /api/flowpanel/<resource>/bulk-actions/<key>` — runs a bulk action
 * against a selection of IDs.
 *
 * Body: JSON `{ ids: string[], input?: unknown }` (canonical) or form-data
 * with one or more `ids` fields.
 *
 * Flow:
 *
 * 1. Look up resource + action by key (`resource.options.bulkActions`).
 *    404 if either is missing.
 * 2. Parse `ids` from the body. 400 if missing / empty.
 * 3. Resource-level role + scope.
 * 4. Per-action `requireRole`.
 * 5. Call `action.run(ids, input, ctx)`. The action is responsible for its
 *    own atomicity / partial-failure semantics — flowpanel treats the
 *    `ActionResult` as the single outcome.
 * 6. On success: emit one audit event tagged with the count + the first
 *    few IDs (capped to avoid PII-flooding audit sinks), apply side
 *    effects (publish + revalidate), return the result.
 *
 * Why a single call rather than per-id iteration: bulk SQL operations
 * (`UPDATE WHERE id IN (...)`) need atomic semantics. If a user wants
 * per-item progress they should implement `run` to iterate and publish
 * progress events through `ctx.publish`.
 *
 * @example Wired into the catch-all handler in `handlers()`:
 * ```ts
 * if (route.length === 3 && route[1] === "bulk-actions") {
 *   return postBulkAction(req, { params: Promise.resolve({ resource, action }) });
 * }
 * ```
 */
/**
 * Hard cap on the number of ids a single bulk action may target. A
 * hand-crafted POST could otherwise pass tens of thousands of ids and force a
 * giant `WHERE id IN (...)` (or a server-side per-id loop), turning the
 * endpoint into a cheap DoS vector. 1000 is comfortably above any realistic
 * page-selection while keeping the query bounded.
 */
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

    const body = await parseBulkBody(req);
    if (!body) {
      return Response.json(
        { ok: false, error: "ids must be a non-empty array of strings" },
        { status: 400 },
      );
    }
    if (body.ids.length > MAX_BULK) {
      return Response.json({ ok: false, error: `too many ids (max ${MAX_BULK})` }, { status: 422 });
    }

    // Validate `input` against the action's declared `form` before running —
    // same defense-in-depth as the row-action path.
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

    const reqCtx = await buildRequestContext({ req, config });

    const resourceGuard = guardResourceAccess(config, resource, reqCtx);
    if (resourceGuard) return resourceGuard;
    const roleGuard = guardActionRole(action.requireRole, reqCtx);
    if (roleGuard) return roleGuard;

    const actionCtx = {
      ...reqCtx,
      db: config.adapter.db,
      publish: async (channel: string, payload?: unknown) => {
        await publish(channel, payload);
      },
    };

    try {
      const result = (await runWithRequestContext(reqCtx, () =>
        action.run(body.ids, body.input, actionCtx),
      )) as ActionResult;

      // Cap the targetId blob to the first 10 IDs to keep audit rows small
      // — sinks often write to a DB column with a reasonable max length.
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
  };
}
