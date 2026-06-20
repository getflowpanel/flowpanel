import type { ResolvedAdminConfig } from "@flowpanel/core";
import { bulkActionRoute } from "./actions/bulk-action.js";
import { dashboardActionRoute } from "./actions/dashboard-action.js";
import { inlineUpdateRoute } from "./actions/inline-update.js";
import { referenceSearchRoute } from "./actions/reference-search.js";
import { resourceCreateRoute, resourceUpdateRoute } from "./actions/resource-form.js";
import { importRoute } from "./actions/resource-import.js";
import { restoreRoute } from "./actions/restore.js";
import { rowActionRoute } from "./actions/row-action.js";
import { drawerActionRoute, drawerRoute } from "./drawer/drawer-route.js";

/** The catch-all `/api/flowpanel/[...route]/route.ts` handler. */
export function handlers(config: ResolvedAdminConfig): {
  GET: (req: Request, ctx: { params: Promise<{ route?: string[] }> }) => Promise<Response>;
  POST: (req: Request, ctx: { params: Promise<{ route?: string[] }> }) => Promise<Response>;
} {
  const getDrawer = drawerRoute(config);
  const getReferenceSearch = referenceSearchRoute(config);
  const postDrawerAction = drawerActionRoute(config);
  const postRowAction = rowActionRoute(config);
  const postBulkAction = bulkActionRoute(config);
  const postInlineUpdate = inlineUpdateRoute(config);
  const postRestore = restoreRoute(config);
  const postDashboardAction = dashboardActionRoute(config);
  const postImport = importRoute(config);
  const postResourceCreate = resourceCreateRoute(config);
  const postResourceUpdate = resourceUpdateRoute(config);

  async function GET(
    req: Request,
    ctx: { params: Promise<{ route?: string[] }> },
  ): Promise<Response> {
    const { route = [] } = await ctx.params;
    if (route.length === 3 && route[0] === "drawer") {
      const resource = route[1];
      const id = route[2];
      if (!resource || !id) {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      return getDrawer(req, { params: Promise.resolve({ resource, id }) });
    }
    if (route.length === 3 && route[1] === "reference") {
      const resource = route[0];
      const field = route[2];
      if (!resource || !field) {
        return Response.json({ error: "bad request" }, { status: 400 });
      }
      return getReferenceSearch(req, { params: Promise.resolve({ resource, field }) });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  async function POST(
    req: Request,
    ctx: { params: Promise<{ route?: string[] }> },
  ): Promise<Response> {
    const { route = [] } = await ctx.params;
    if (route.length === 5 && route[0] === "drawer" && route[3] === "actions") {
      const resource = route[1];
      const id = route[2];
      const action = route[4];
      if (!resource || !id || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postDrawerAction(req, { params: Promise.resolve({ resource, id, action }) });
    }
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
    if (route.length === 4 && route[2] === "actions") {
      const resource = route[0];
      const id = route[1];
      const action = route[3];
      if (!resource || !id || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postRowAction(req, { params: Promise.resolve({ resource, id, action }) });
    }
    if (route.length === 3 && route[1] === "bulk-actions") {
      const resource = route[0];
      const action = route[2];
      if (!resource || !action) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postBulkAction(req, { params: Promise.resolve({ resource, action }) });
    }
    if (route.length === 2 && route[1] === "import") {
      const resource = route[0];
      if (!resource) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postImport(req, { params: Promise.resolve({ resource }) });
    }
    if (route.length === 2 && route[1] === "create") {
      const resource = route[0];
      if (!resource) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postResourceCreate(req, { params: Promise.resolve({ resource }) });
    }
    if (route.length === 3 && route[2] === "update") {
      const resource = route[0];
      const id = route[1];
      if (!resource || !id) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postInlineUpdate(req, { params: Promise.resolve({ resource, id }) });
    }
    if (route.length === 3 && route[2] === "edit") {
      const resource = route[0];
      const id = route[1];
      if (!resource || !id) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postResourceUpdate(req, { params: Promise.resolve({ resource, id }) });
    }
    if (route.length === 3 && route[2] === "restore") {
      const resource = route[0];
      const id = route[1];
      if (!resource || !id) {
        return Response.json({ ok: false, error: "bad request" }, { status: 400 });
      }
      return postRestore(req, { params: Promise.resolve({ resource, id }) });
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return { GET, POST };
}
