import type {
  ActionResult,
  DrawerAction,
  DrawerConfig,
  DrawerTab,
  ItemQueryContext,
  ListQueryContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { requireAuthorized } from "../runtime/require-authorized.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { parseActionBody } from "./parse-action-body.js";
import { type SerializedWidget, serializeWidget } from "./serialize-widget.js";

// Re-exported so external consumers of `drawer-route.ts` keep their import
// shape after the split.
export type { SerializedWidget };

/**
 * Wire-safe shape of `DrawerAction`. The `run` function can't cross the
 * network boundary; strip it server-side and resolve on POST to
 * /api/flowpanel/drawer/<resource>/<id>/actions/<key>.
 */
export interface SerializedDrawerAction {
  key: string;
  label: string;
  variant?: "default" | "destructive";
  icon?: string;
  confirm?: string;
  form?: DrawerAction["form"];
  palette?: boolean;
}

export type SerializedDrawerTab =
  | { kind: "fields"; key: string; label: string; fields: "*" | string[] }
  | {
      kind: "resource";
      key: string;
      label: string;
      resource: string;
      rows: Record<string, unknown>[];
      columns: string[];
    }
  | {
      kind: "widgets";
      key: string;
      label: string;
      widgets: SerializedWidget[];
    };

export interface DrawerPayload {
  row: Record<string, unknown>;
  header: string;
  width: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  fields: "*" | string[];
  tabs: SerializedDrawerTab[] | null;
  actions: SerializedDrawerAction[];
}

function serializeAction(a: DrawerAction): SerializedDrawerAction {
  const out: SerializedDrawerAction = { key: a.key, label: a.label };
  if (a.variant !== undefined) out.variant = a.variant;
  if (a.icon !== undefined) out.icon = a.icon;
  if (a.confirm !== undefined) out.confirm = a.confirm;
  if (a.form !== undefined) out.form = a.form;
  if (a.palette !== undefined) out.palette = a.palette;
  return out;
}

async function serializeTab(
  tab: DrawerTab,
  row: Record<string, unknown>,
  config: ResolvedAdminConfig,
  reqCtx: Awaited<ReturnType<typeof buildRequestContext>>,
  req: Request,
): Promise<SerializedDrawerTab> {
  if ("fields" in tab) {
    return { kind: "fields", key: tab.key, label: tab.label, fields: tab.fields };
  }
  if ("widgets" in tab) {
    const widgetCtx: WidgetContext = {
      db: config.adapter.db,
      session: reqCtx.session,
      dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
      req,
    };
    const widgets: SerializedWidget[] = [];
    for (const w of tab.widgets) {
      widgets.push(await serializeWidget(w, config, reqCtx, widgetCtx, req));
    }
    return { kind: "widgets", key: tab.key, label: tab.label, widgets };
  }
  // Resource tab: run a bounded list query filtered by the drawer's parent row.
  const target = config.resourcesByName.get(tab.resource);
  if (!target) {
    return {
      kind: "resource",
      key: tab.key,
      label: tab.label,
      resource: tab.resource,
      rows: [],
      columns: [],
    };
  }
  const filter = typeof tab.filter === "function" ? tab.filter(row) : {};
  const softDelete = target.options.delete?.softDelete;
  const listCtx: ListQueryContext<unknown> = {
    ...reqCtx,
    req,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters: filter,
    sort: null,
    page: 1,
    pageSize: 20,
    search: "",
    ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
  };
  const result = await runWithRequestContext(reqCtx, () =>
    config.adapter.list(target.ref, listCtx),
  );
  const columns = (target.options.columns as unknown[]).map((c) => {
    if (typeof c === "string") return c;
    const col = c as { field?: string };
    return String(col.field ?? "");
  });
  return {
    kind: "resource",
    key: tab.key,
    label: tab.label,
    resource: tab.resource,
    rows: result.rows as Record<string, unknown>[],
    columns: columns.filter((c) => c),
  };
}

export interface DrawerRouteCtx {
  params: Promise<{ resource: string; id: string }>;
}

/**
 * Factory producing the Next 15 route handler for `/api/flowpanel/drawer/[resource]/[id]`.
 * Returns a precomputed `DrawerPayload` — row + metadata + serialized tabs in one pass.
 */
export function drawerRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);
  return async function GET(req: Request, ctx: DrawerRouteCtx): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ error: "resource not found" }, { status: 404 });
    }
    const drawer: DrawerConfig | undefined = resource.options.drawer;
    if (!drawer) {
      return Response.json(
        { error: `resource "${resourceName}" has no drawer config` },
        { status: 400 },
      );
    }

    const reqCtx = await buildRequestContext({ req, config });
    try {
      requireAuthorized(config, resource, reqCtx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "forbidden";
      return Response.json({ error: msg }, { status: 403 });
    }

    const itemCtx: ItemQueryContext = {
      ...reqCtx,
      db: config.adapter.db,
      dateRange: { from: new Date(0), to: new Date() },
      searchParams: new URLSearchParams(),
      signal: new AbortController().signal,
      id,
    };
    const row = (await runWithRequestContext(reqCtx, () =>
      config.adapter.get(resource.ref, itemCtx),
    )) as Record<string, unknown> | null;
    if (!row) {
      return Response.json({ error: "not found" }, { status: 404 });
    }

    const header =
      typeof drawer.header === "function"
        ? String(drawer.header(row) ?? "")
        : String(row[(resource.options.rowKey as string | undefined) ?? "id"] ?? "");
    const width = drawer.width ?? "lg";
    const fields = drawer.fields ?? "*";

    const tabs: SerializedDrawerTab[] | null = drawer.tabs
      ? await Promise.all(drawer.tabs.map((t) => serializeTab(t, row, config, reqCtx, req)))
      : null;

    const actions = (drawer.actions ?? []).map(serializeAction);

    const payload: DrawerPayload = {
      row,
      header,
      width,
      fields,
      tabs,
      actions,
    };
    return Response.json(payload);
  };
}

/**
 * POST /api/flowpanel/drawer/[resource]/[id]/actions/[action]
 *
 * Loads the row, parses the request body (form-data or JSON), and runs the
 * user-authored `action.run(row, input, ctx)`. Successful results flow through
 * `applyActionResult` to publish an SSE event + revalidate the drawer's parent
 * path; the raw `ActionResult` is returned as JSON so the client can surface
 * toasts / downloads / redirects via the browser.
 */
export function drawerActionRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);
  return async function POST(
    req: Request,
    ctx: { params: Promise<{ resource: string; id: string; action: string }> },
  ): Promise<Response> {
    const { resource: resourceName, id, action: actionKey } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    const action = resource.options.drawer?.actions?.find((a) => a.key === actionKey);
    if (!action) {
      return Response.json({ ok: false, error: "action not found" }, { status: 404 });
    }

    const reqCtx = await buildRequestContext({ req, config });
    try {
      requireAuthorized(config, resource, reqCtx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "forbidden";
      return Response.json({ ok: false, error: msg }, { status: 403 });
    }

    const itemCtx: ItemQueryContext = {
      ...reqCtx,
      db: config.adapter.db,
      dateRange: { from: new Date(0), to: new Date() },
      searchParams: new URLSearchParams(),
      signal: new AbortController().signal,
      id,
    };
    const row = (await runWithRequestContext(reqCtx, () =>
      config.adapter.get(resource.ref, itemCtx),
    )) as Record<string, unknown> | null;
    if (!row) {
      return Response.json({ ok: false, error: "not found" }, { status: 404 });
    }

    const input = await parseActionBody(req);

    const actionCtx = {
      ...reqCtx,
      db: config.adapter.db,
      publish: async (channel: string, payload?: unknown) => {
        await publish(channel, payload);
      },
    };

    try {
      const result = (await runWithRequestContext(reqCtx, () =>
        action.run(row, input, actionCtx),
      )) as ActionResult;
      if (result.ok) {
        await applyActionResult(result, {
          resourceName,
          pathname: `/admin/${resourceName}`,
        });
      }
      return Response.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "action failed";
      return Response.json({ ok: false, error: msg }, { status: 500 });
    }
  };
}
