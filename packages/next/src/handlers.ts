import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { errorResult, FlowpanelNotFoundError } from "@flowpanel/core";
import { bulkActionRoute } from "./actions/bulk-action.js";
import { dashboardActionRoute } from "./actions/dashboard-action.js";
import { inlineUpdateRoute } from "./actions/inline-update.js";
import { referenceSearchRoute } from "./actions/reference-search.js";
import { resourceCreateRoute, resourceUpdateRoute } from "./actions/resource-form.js";
import { importRoute } from "./actions/resource-import.js";
import { restoreRoute } from "./actions/restore.js";
import { rowActionRoute } from "./actions/row-action.js";
import { createResourceController } from "./controllers/resource-controller.js";
import { drawerActionRoute, drawerRoute } from "./drawer/drawer-route.js";
import { withGuards } from "./runtime/with-guards.js";
import { methodNotAllowed, wireResponse } from "./wire/response.js";

export interface RouteContext {
  params: Promise<{ route?: string[] }>;
}

export type RouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>;

export interface FlowpanelHandlers {
  GET: RouteHandler;
  POST: RouteHandler;
  PUT: RouteHandler;
  PATCH: RouteHandler;
  DELETE: RouteHandler;
  OPTIONS: RouteHandler;
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const MAX_JSON_BODY = 1024 * 1024;

function badTransport(
  code: "bad_request" | "payload_too_large" | "unsupported_media_type",
  message: string,
  status: number,
): Response {
  return Response.json({ ok: false, error: { code, message } }, { status });
}

async function readJsonObject(req: Request): Promise<Record<string, unknown> | Response> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return badTransport("unsupported_media_type", "Expected application/json.", 415);
  }
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY) {
    return badTransport("payload_too_large", "JSON body exceeds 1 MiB.", 413);
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY) {
    return badTransport("payload_too_large", "JSON body exceeds 1 MiB.", 413);
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return badTransport("bad_request", "JSON body must be an object.", 400);
    }
    return value as Record<string, unknown>;
  } catch {
    return badTransport("bad_request", "Invalid JSON body.", 400);
  }
}

function resourceResult(
  config: ResolvedAdminConfig,
  req: Request,
  resourceName: string,
  operation: "read" | "create" | "update" | "delete",
  run: (
    controller: ReturnType<typeof createResourceController>,
    ctx: RequestContext,
  ) => Promise<Response>,
): Promise<Response> {
  return withGuards(
    config,
    req,
    { operation, write: operation !== "read", route: resourceName },
    async (ctx) => {
      const resource = config.resourcesByName.get(resourceName);
      if (!resource) {
        return wireResponse(errorResult(new FlowpanelNotFoundError(), ctx.requestId ?? "unknown"));
      }
      return run(createResourceController(config, resource, ctx), ctx);
    },
  );
}

/** The catch-all `/api/flowpanel/[...route]/route.ts` handler. */
export function handlers(config: ResolvedAdminConfig): FlowpanelHandlers {
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
    if (route.length === 1 && route[0] && config.resourcesByName.has(route[0])) {
      const resource = route[0];
      const url = new URL(req.url);
      const filters: Record<string, unknown> = {};
      for (const [key, value] of url.searchParams) {
        if (key.startsWith("filter.")) filters[key.slice(7)] = value;
      }
      return resourceResult(config, req, resource, "read", async (controller) =>
        wireResponse(
          await controller.list({
            page: Number(url.searchParams.get("page") ?? 1),
            pageSize: Number(url.searchParams.get("pageSize") ?? 20),
            search: url.searchParams.get("search") ?? "",
            filters,
          }),
        ),
      );
    }
    if (route.length === 2 && route[0] && route[1]) {
      return resourceResult(config, req, route[0], "read", async (controller) =>
        wireResponse(await controller.get(route[1] as string)),
      );
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
    if (route.length === 1 && route[0] && config.resourcesByName.has(route[0])) {
      const input = await readJsonObject(req);
      if (input instanceof Response) return input;
      return resourceResult(config, req, route[0], "create", async (controller) =>
        wireResponse(await controller.create(input)),
      );
    }
    return Response.json({ error: "not found" }, { status: 404 });
  }

  async function update(req: Request, ctx: RouteContext): Promise<Response> {
    const { route = [] } = await ctx.params;
    if (route.length !== 2 || !route[0] || !route[1]) {
      return methodNotAllowed(METHODS);
    }
    const input = await readJsonObject(req);
    if (input instanceof Response) return input;
    return resourceResult(config, req, route[0], "update", async (controller) =>
      wireResponse(await controller.update(route[1] as string, input)),
    );
  }

  async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
    const { route = [] } = await ctx.params;
    if (route.length !== 2 || !route[0] || !route[1]) return methodNotAllowed(METHODS);
    return resourceResult(config, req, route[0], "delete", async (controller) =>
      wireResponse(await controller.delete(route[1] as string)),
    );
  }

  async function OPTIONS(): Promise<Response> {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: METHODS.join(", "),
        "Access-Control-Allow-Methods": METHODS.join(", "),
        "Access-Control-Allow-Headers": "content-type, x-request-id",
      },
    });
  }

  return { GET, POST, PUT: update, PATCH: update, DELETE, OPTIONS };
}
