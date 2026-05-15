import type { ResolvedAdminConfig } from "@flowpanel/core";
import { drawerActionRoute, drawerRoute } from "./drawer/drawer-route.js";

/**
 * The catch-all `/api/flowpanel/[...route]/route.ts` handler.
 *
 * Routes (relative to `/api/flowpanel/`):
 *
 *   GET  drawer/<resource>/<id>                    → drawerRoute
 *   POST drawer/<resource>/<id>/actions/<action>   → drawerActionRoute
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
  // Build the inner handlers once. Both factories internally call
  // `bindPublisher(config)` (idempotent), so re-binding per request is fine.
  const getDrawer = drawerRoute(config);
  const postDrawerAction = drawerActionRoute(config);

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
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return { GET, POST };
}
