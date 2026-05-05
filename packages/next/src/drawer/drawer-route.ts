import type {
  DrawerAction,
  DrawerConfig,
  DrawerTab,
  ItemQueryContext,
  ListQueryContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  type RequireRole,
  runWithRequestContext,
} from "@flowpanel/core";
import { buildRequestContext } from "../runtime/request-setup.js";

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
  | { kind: "widgets-deferred"; key: string; label: string };

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
    // Widget tabs require SSE broker + client-side widget renderer; deferred to M3.
    return { kind: "widgets-deferred", key: tab.key, label: tab.label };
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
  const listCtx: ListQueryContext<Record<string, unknown>> = {
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
      checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
      assertResourceScope({
        hasGlobal: !!config.scope,
        resourceScope: resource.options.scope as
          | "bypass"
          | ((...a: unknown[]) => unknown)
          | undefined,
      });
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
 * Placeholder handler for drawer action execution. The runner lands in M3
 * alongside SSE publish + form parsing. For M2 we return 501 so the UI can
 * wire the button with a clear message.
 */
export function drawerActionRoute(_config: ResolvedAdminConfig) {
  return async function POST(
    _req: Request,
    _ctx: { params: Promise<{ resource: string; id: string; action: string }> },
  ): Promise<Response> {
    return Response.json({ error: "drawer action runner lands in 0.2.0 (M3)" }, { status: 501 });
  };
}
