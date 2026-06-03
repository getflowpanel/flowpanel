import type { ResolvedAdminConfig } from "@flowpanel/core";
import { bulkActionRoute } from "./actions/bulk-action.js";
import { dashboardActionRoute } from "./actions/dashboard-action.js";
import { inlineUpdateRoute } from "./actions/inline-update.js";
import { rowActionRoute } from "./actions/row-action.js";
import { drawerActionRoute, drawerRoute } from "./drawer/drawer-route.js";

/**
 * The catch-all `/api/flowpanel/[...route]/route.ts` handler.
 *
 * Routes (relative to `/api/flowpanel/`):
 *
 *   GET  drawer/<resource>/<id>                    → drawerRoute
 *   POST drawer/<resource>/<id>/actions/<action>   → drawerActionRoute
 *   POST <resource>/<id>/actions/<action>          → rowActionRoute
 *   POST <resource>/<id>/update                    → inlineUpdateRoute
 *   POST <resource>/bulk-actions/<action>          → bulkActionRoute
 *   POST dashboards/<encoded-path>/actions/<key>   → dashboardActionRoute
 *
 * The `drawer/` prefix on the drawer routes disambiguates them from the
 * row-action route (same trailing shape). The `bulk-actions/` segment
 * distinguishes bulk from row at length 3.
 *
 * Anything else returns 404. The `/api/flowpanel/stream` endpoint is wired
 * separately via `stream(config)` because it has a long-running SSE response
 * that can't share a runtime with regular request/response handlers.
 *
 * Server Actions (resource create/update/delete from the auto-form pages)
 * do NOT route through here — they use Next.js Server Actions directly,
 * called as functions from React components.
 */
export function handlers(config: ResolvedAdminConfig): {
  GET: (req: Request, ctx: { params: Promise<{ route?: string[] }> }) => Promise<Response>;
  POST: (req: Request, ctx: { params: Promise<{ route?: string[] }> }) => Promise<Response>;
} {
  // Build the inner handlers once. Each factory internally calls
  // `bindPublisher(config)` (idempotent), so re-binding per request is fine.
  const getDrawer = drawerRoute(config);
  const postDrawerAction = drawerActionRoute(config);
  const postRowAction = rowActionRoute(config);
  const postBulkAction = bulkActionRoute(config);
  const postInlineUpdate = inlineUpdateRoute(config);
  const postDashboardAction = dashboardActionRoute(config);

  async function GET(
    req: Request,
    ctx: { params: Promise<{ route?: string[] }> },
  ): Promise<Response> {
    const { route = [] } = await ctx.params;
    // GET drawer/<resource>/<id>
    if (route.length === 3 && route[0] === "drawer") {
      const resource = route[1];
      const id = route[2];
      if (!resource || !id) {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      return getDrawer(req, { params: Promise.resolve({ resource, id }) });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  async function POST(
    req: Request,
    ctx: { params: Promise<{ route?: string[] }> },
  ): Promise<Response> {
    const { route = [] } = await ctx.params;
    // POST drawer/<resource>/<id>/actions/<action>
    if (route.length === 5 && route[0] === "drawer" && route[3] === "actions") {
      const resource = route[1];
      const id = route[2];
      const action = route[4];
      if (!resource || !id || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postDrawerAction(req, { params: Promise.resolve({ resource, id, action }) });
    }
    // POST dashboards/<encoded-path>/actions/<key> — dashboard-level action.
    // MUST precede the row-action branch below (same length / shape; the
    // `dashboards` literal is the disambiguator).
    if (route.length === 4 && route[0] === "dashboards" && route[2] === "actions") {
      const dashboard = route[1];
      const action = route[3];
      if (!dashboard || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postDashboardAction(req, {
        params: Promise.resolve({ dashboard, action }),
      });
    }
    // POST <resource>/<id>/actions/<action> — row action menu / inline button
    if (route.length === 4 && route[2] === "actions") {
      const resource = route[0];
      const id = route[1];
      const action = route[3];
      if (!resource || !id || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postRowAction(req, { params: Promise.resolve({ resource, id, action }) });
    }
    // POST <resource>/bulk-actions/<action> — bar above table
    if (route.length === 3 && route[1] === "bulk-actions") {
      const resource = route[0];
      const action = route[2];
      if (!resource || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postBulkAction(req, { params: Promise.resolve({ resource, action }) });
    }
    // POST <resource>/<id>/update — inline cell save
    if (route.length === 3 && route[2] === "update") {
      const resource = route[0];
      const id = route[1];
      if (!resource || !id) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postInlineUpdate(req, { params: Promise.resolve({ resource, id }) });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return { GET, POST };
}
