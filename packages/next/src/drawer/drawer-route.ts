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
import {
  assertResourceScope,
  checkRequireRole,
  type RequireRole,
  runWithRequestContext,
} from "@flowpanel/core";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { bindPublisher, publish } from "../runtime/publish.js";
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

export type SerializedWidget =
  | {
      kind: "metric";
      label: string;
      value: number | string;
      format?: string;
      sublabel?: string;
      tone?: string;
      span?: number;
    }
  | {
      kind: "table";
      label?: string;
      rows: Record<string, unknown>[];
      columns: string[];
      span?: number;
    }
  | {
      kind: "statGroup";
      label?: string;
      stats: { label: string; value: unknown; format?: string; tone?: string }[];
      span?: number;
    }
  | {
      kind: "chart";
      subkind: "area" | "bar" | "line" | "pie";
      label: string;
      dataPoints: number;
      span?: number;
    }
  | { kind: "unsupported"; label?: string; reason: string; span?: number };

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
      try {
        switch (w.kind) {
          case "metric": {
            const value = await runWithRequestContext(reqCtx, () => w.query(widgetCtx));
            widgets.push({
              kind: "metric",
              label: w.label,
              value,
              ...(w.options.format ? { format: w.options.format } : {}),
              ...(w.options.sublabel ? { sublabel: w.options.sublabel } : {}),
              ...(w.options.tone ? { tone: w.options.tone } : {}),
              ...(w.options.span ? { span: w.options.span } : {}),
            });
            break;
          }
          case "table": {
            let rows: Record<string, unknown>[] = [];
            let columns: string[] = [];
            if (w.options.query) {
              const raw = (await runWithRequestContext(reqCtx, () =>
                w.options.query!(widgetCtx),
              )) as unknown[];
              rows = raw as Record<string, unknown>[];
            } else if (w.options.resource) {
              const target = config.resourcesByName.get(w.options.resource);
              if (target) {
                const softDelete = target.options.delete?.softDelete;
                const listCtx: ListQueryContext<unknown> = {
                  ...reqCtx,
                  req,
                  db: config.adapter.db,
                  dateRange: { from: new Date(0), to: new Date() },
                  searchParams: new URLSearchParams(),
                  signal: new AbortController().signal,
                  filters: {},
                  sort: null,
                  page: 1,
                  pageSize: w.options.limit ?? 10,
                  search: "",
                  ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
                };
                const r = await runWithRequestContext(reqCtx, () =>
                  config.adapter.list(target.ref, listCtx),
                );
                rows = r.rows as Record<string, unknown>[];
                columns = (target.options.columns as unknown[])
                  .map((c) =>
                    typeof c === "string" ? c : String((c as { field?: string }).field ?? ""),
                  )
                  .filter(Boolean);
              }
            }
            if (w.options.columns && w.options.columns.length > 0) {
              columns = w.options.columns;
            } else if (columns.length === 0 && rows[0]) {
              columns = Object.keys(rows[0]);
            }
            widgets.push({
              kind: "table",
              ...(w.options.label ? { label: w.options.label } : {}),
              rows,
              columns,
              ...(w.options.span ? { span: w.options.span } : {}),
            });
            break;
          }
          case "statGroup": {
            const stats = await Promise.all(
              w.options.stats.map(async (s) => ({
                label: s.label,
                value:
                  typeof s.value === "function"
                    ? await runWithRequestContext(reqCtx, () =>
                        (s.value as (c: WidgetContext) => Promise<unknown>)(widgetCtx),
                      )
                    : s.value,
                ...(s.format ? { format: s.format } : {}),
                ...(s.tone ? { tone: s.tone } : {}),
              })),
            );
            widgets.push({
              kind: "statGroup",
              ...(w.options.label ? { label: w.options.label } : {}),
              stats,
              ...(w.options.span ? { span: w.options.span } : {}),
            });
            break;
          }
          case "areaChart":
          case "barChart":
          case "lineChart":
          case "pieChart": {
            const data = (await runWithRequestContext(reqCtx, () =>
              w.query(widgetCtx),
            )) as unknown[];
            const subkind = (
              w.kind === "areaChart"
                ? "area"
                : w.kind === "barChart"
                  ? "bar"
                  : w.kind === "lineChart"
                    ? "line"
                    : "pie"
            ) as "area" | "bar" | "line" | "pie";
            widgets.push({
              kind: "chart",
              subkind,
              label: w.label,
              dataPoints: data.length,
              ...(w.options.span ? { span: w.options.span } : {}),
            });
            break;
          }
          default:
            // custom widgets — React component refs can't serialize through a
            // fetch boundary. Surface a clear message rather than a blank tile.
            widgets.push({
              kind: "unsupported",
              reason: "custom widgets are not supported in drawer tabs",
            });
        }
      } catch (err) {
        widgets.push({
          kind: "unsupported",
          reason: err instanceof Error ? err.message : "widget query failed",
        });
      }
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

    // Parse the body. Drawer actions may submit via <Form> (form-data),
    // programmatic fetch with JSON, or no body (click-to-run buttons).
    let input: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") ?? "";
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      try {
        const fd = await req.formData();
        for (const [k, v] of fd.entries()) {
          input[k] = v;
        }
      } catch {
        // empty / malformed body — treat as no input
      }
    } else if (contentType.includes("application/json")) {
      try {
        input = (await req.json()) as Record<string, unknown>;
      } catch {
        // empty / malformed body — treat as no input
      }
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
