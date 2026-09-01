import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { errorResult, FlowpanelNotFoundError } from "@flowpanel/core";
import { bulkActionRoute } from "./actions/bulk-action";
import { dashboardActionRoute } from "./actions/dashboard-action";
import { inlineUpdateRoute } from "./actions/inline-update";
import { referenceSearchRoute } from "./actions/reference-search";
import { resourceCreateRoute, resourceUpdateRoute } from "./actions/resource-form";
import { importRoute } from "./actions/resource-import";
import { restoreRoute } from "./actions/restore";
import { rowActionRoute } from "./actions/row-action";
import { createResourceController } from "./controllers/resource-controller";
import { drawerActionRoute, drawerRoute } from "./drawer/drawer-route";
import {
  declaredFieldSet,
  resolveFilterSpecs,
  sanitizeFilterValues,
} from "./runtime/parse-list-params";
import { filterReadableDeclarations, resolveReadableFieldSet } from "./runtime/readable-fields";
import { readJsonObject as readJsonBody } from "./runtime/request-body";
import { withGuards } from "./runtime/with-guards";
import { methodNotAllowed, wireResponse } from "./wire/response";

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
  const parsed = await readJsonBody(req);
  if (parsed.ok) return parsed.value;
  if (parsed.reason === "payload-too-large") {
    return badTransport("payload_too_large", "JSON body exceeds 1 MiB.", 413);
  }
  if (parsed.reason === "object-required") {
    return badTransport("bad_request", "JSON body must be an object.", 400);
  }
  return badTransport("bad_request", "Invalid JSON body.", 400);
}

type RouteHandlerWith<Params> = (
  req: Request,
  ctx: { params: Promise<Params> },
) => Promise<Response>;

interface RoutePattern<Params> {
  /** Literal segments, or `:name` for a captured one. */
  segments: readonly string[];
  handler: RouteHandlerWith<Params>;
}

/** A pattern described the route but a captured segment was empty. */
const MALFORMED = Symbol("malformed-route");

/** Capture a route's named segments, or `null` when the pattern does not describe it. */
function matchRoute(
  segments: readonly string[],
  route: readonly string[],
): Record<string, string> | typeof MALFORMED | null {
  if (segments.length !== route.length) return null;
  const params: Record<string, string> = {};
  let malformed = false;
  for (const [i, segment] of segments.entries()) {
    const value = route[i];
    if (segment.startsWith(":")) {
      if (value) params[segment.slice(1)] = value;
      else malformed = true;
    } else if (segment !== value) return null;
  }
  return malformed ? MALFORMED : params;
}

/** Dispatch to the first pattern that describes `route`. */
function dispatch(
  routes: ReadonlyArray<RoutePattern<never>>,
  req: Request,
  route: readonly string[],
): Promise<Response> | Response | null {
  for (const { segments, handler } of routes) {
    const params = matchRoute(segments, route);
    if (params === null) continue;
    if (params === MALFORMED) {
      return Response.json({ ok: false, error: "bad request" }, { status: 400 });
    }
    return handler(req, { params: Promise.resolve(params as never) });
  }
  return null;
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
    { operation, write: operation !== "read", route: resourceName, envelope: "result" },
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
    const matched = dispatch(
      [
        { segments: ["drawer", ":resource", ":id"], handler: getDrawer },
        { segments: [":resource", "reference", ":field"], handler: getReferenceSearch },
      ] as ReadonlyArray<RoutePattern<never>>,
      req,
      route,
    );
    if (matched) return matched;
    const listed =
      route.length === 1 && route[0] ? config.resourcesByName.get(route[0]) : undefined;
    if (listed && route[0]) {
      const resource = route[0];
      const url = new URL(req.url);
      return resourceResult(config, req, resource, "read", async (controller, ctx) => {
        const declared = declaredFieldSet(listed.options);
        const readable = await resolveReadableFieldSet(declared, listed.options.fieldAccess, ctx);
        const raw: Record<string, unknown> = {};
        for (const [key, value] of url.searchParams) {
          if (!key.startsWith("filter.")) continue;
          const field = key.slice("filter.".length);
          if (readable.has(field)) raw[field] = value;
        }
        const readableFilterDefs = filterReadableDeclarations(listed.options.filters, readable);
        const specs = await resolveFilterSpecs(readableFilterDefs, {
          db: config.adapter.db,
          session: ctx.session,
        });
        const readableSearchFields = (listed.options.search ?? [])
          .map(String)
          .filter((field) => readable.has(field));
        return wireResponse(
          await controller.list({
            page: Number(url.searchParams.get("page") ?? 1),
            pageSize: Number(url.searchParams.get("pageSize") ?? 20),
            search: readableSearchFields.length > 0 ? (url.searchParams.get("search") ?? "") : "",
            filters: sanitizeFilterValues(raw, specs),
          }),
        );
      });
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
    const matched = dispatch(
      [
        {
          segments: ["drawer", ":resource", ":id", "actions", ":action"],
          handler: postDrawerAction,
        },
        {
          segments: ["dashboards", ":dashboard", "actions", ":action"],
          handler: postDashboardAction,
        },
        { segments: [":resource", ":id", "actions", ":action"], handler: postRowAction },
        { segments: [":resource", "bulk-actions", ":action"], handler: postBulkAction },
        { segments: [":resource", "import"], handler: postImport },
        { segments: [":resource", "create"], handler: postResourceCreate },
        { segments: [":resource", ":id", "update"], handler: postInlineUpdate },
        { segments: [":resource", ":id", "edit"], handler: postResourceUpdate },
        { segments: [":resource", ":id", "restore"], handler: postRestore },
      ] as ReadonlyArray<RoutePattern<never>>,
      req,
      route,
    );
    if (matched) return matched;
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
