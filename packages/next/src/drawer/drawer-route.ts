// LOC-OK: GET drawer payload + POST drawer action share the same DrawerRouteCtx
import type {
  ActionResult,
  ColumnFormat,
  DrawerAction,
  DrawerConfig,
  DrawerTab,
  ItemQueryContext,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { createElement, Fragment, type ReactNode } from "react";
import {
  actorIdFromSession,
  buildAuditEvent,
  maybeEmitAudit,
  safeErrorMessage,
  validateActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { projectRow } from "../runtime/project-row.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";
import { parseActionBody } from "./parse-action-body.js";
import { type SerializedWidget, serializeWidget } from "./serialize-widget.js";

export type { SerializedWidget };

/** Wire-safe shape of `DrawerAction`. */
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
  /** Field → HTML for fields whose column declares a `render`. */
  prerendered: Record<string, string>;
  /** Field → column label, so drawer rows read like their table headers. */
  labels: Record<string, string>;
  /** Field → column `format`. Plain data, rendered client-side exactly as the table does. */
  formats: Record<string, ColumnFormat>;
}

/** Map of field → column `format`, so drawer rows format like their table cells. */
function buildFieldFormats(columns: ReadonlyArray<unknown>): Record<string, ColumnFormat> {
  const out: Record<string, ColumnFormat> = {};
  for (const c of columns) {
    if (typeof c !== "object" || c === null) continue;
    const col = c as { field?: string; format?: ColumnFormat };
    if (col.field && col.format !== undefined) out[col.field] = col.format;
  }
  return out;
}

/** Map of field → column `label`, for fields whose column sets one. */
function buildFieldLabels(columns: ReadonlyArray<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of columns) {
    if (typeof c !== "object" || c === null) continue;
    const col = c as { field?: string; label?: string };
    if (col.field && col.label) out[col.field] = col.label;
  }
  return out;
}

let renderToStaticMarkupFn: ((node: ReactNode) => string) | null = null;
async function getRenderToStaticMarkup(): Promise<(node: ReactNode) => string> {
  if (!renderToStaticMarkupFn) {
    // @ts-expect-error -- runtime export exists; ./server declarations don't resolve here
    const mod = (await import("react-dom/server")) as {
      renderToStaticMarkup: (node: ReactNode) => string;
    };
    renderToStaticMarkupFn = mod.renderToStaticMarkup;
  }
  return renderToStaticMarkupFn;
}

async function prerenderRowFields(
  columns: ReadonlyArray<unknown>,
  row: Record<string, unknown>,
  reqCtx: unknown,
): Promise<Record<string, string>> {
  const withRender = columns.filter(
    (c): c is { field: string; render: (row: unknown, ctx?: unknown) => ReactNode } =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as { field?: unknown }).field === "string" &&
      typeof (c as { render?: unknown }).render === "function",
  );
  if (withRender.length === 0) return {};
  const renderToStaticMarkup = await getRenderToStaticMarkup();
  const out: Record<string, string> = {};
  for (const col of withRender) {
    try {
      out[col.field] = renderToStaticMarkup(createElement(Fragment, null, col.render(row, reqCtx)));
    } catch {}
  }
  return out;
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
  reqCtx: RequestContext,
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
  try {
    checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
  } catch {
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
    ...scopeBinding(config, target, reqCtx),
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
    rows: (result.rows as Record<string, unknown>[]).map((r) => projectRow(target, r)),
    columns: columns.filter((c) => c),
  };
}

export interface DrawerRouteCtx {
  params: Promise<{ resource: string; id: string }>;
}

/** Factory producing the Next 15 route handler for `/api/flowpanel/drawer/[resource]/[id]`. */
export function drawerRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);
  return async function GET(req: Request, ctx: DrawerRouteCtx): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return Response.json({ ok: false, error: "resource not found" }, { status: 404 });
    }
    const drawer: DrawerConfig | undefined = resource.options.drawer;
    if (!drawer) {
      return Response.json(
        { ok: false, error: `resource "${resourceName}" has no drawer config` },
        { status: 400 },
      );
    }

    return withGuards(config, req, { resource, write: false }, async (reqCtx) => {
      const itemCtx: ItemQueryContext = {
        ...reqCtx,
        db: config.adapter.db,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      const row = (await runWithRequestContext(reqCtx, () =>
        config.adapter.get(resource.ref, itemCtx),
      )) as Record<string, unknown> | null;
      if (!row) {
        return Response.json({ ok: false, error: "not found" }, { status: 404 });
      }

      const header =
        typeof drawer.header === "function"
          ? String(drawer.header(row) ?? "")
          : String(row[(resource.options.rowKey as string | undefined) ?? "id"] ?? "");

      const tabs: SerializedDrawerTab[] | null = drawer.tabs
        ? await Promise.all(drawer.tabs.map((t) => serializeTab(t, row, config, reqCtx, req)))
        : null;

      const columns = (resource.options.columns as ReadonlyArray<unknown>) ?? [];
      const payload: DrawerPayload = {
        row: projectRow(resource, row),
        header,
        width: drawer.width ?? "lg",
        fields: drawer.fields ?? "*",
        tabs,
        actions: (drawer.actions ?? []).map(serializeAction),
        prerendered: await prerenderRowFields(columns, row, reqCtx),
        labels: buildFieldLabels(columns),
        formats: buildFieldFormats(columns),
      };
      return Response.json(payload);
    });
  };
}

/** POST /api/flowpanel/drawer/[resource]/[id]/actions/[action] */
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

    return withGuards(config, req, { resource }, async (reqCtx) => {
      const itemCtx: ItemQueryContext = {
        ...reqCtx,
        db: config.adapter.db,
        dateRange: { from: new Date(0), to: new Date() },
        searchParams: new URLSearchParams(),
        signal: new AbortController().signal,
        id,
        ...scopeBinding(config, resource, reqCtx),
      };
      const row = (await runWithRequestContext(reqCtx, () =>
        config.adapter.get(resource.ref, itemCtx),
      )) as Record<string, unknown> | null;
      if (!row) {
        return Response.json({ ok: false, error: "not found" }, { status: 404 });
      }

      const input = await parseActionBody(req);

      const inputIssues = validateActionInput(
        action.form as Parameters<typeof validateActionInput>[0],
        input,
      );
      if (inputIssues) {
        return Response.json(
          { ok: false, error: "validation failed", issues: inputIssues },
          { status: 422 },
        );
      }

      const actionCtx = {
        ...reqCtx,
        db: config.adapter.db,
        actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
        publish: async (channel: string, payload?: unknown) => {
          await publish(channel, payload);
        },
      };

      try {
        const result = (await runWithRequestContext(reqCtx, () =>
          action.run(row, input, actionCtx),
        )) as ActionResult;

        await maybeEmitAudit(
          result,
          config.audit,
          resource.options.audit,
          buildAuditEvent(
            reqCtx,
            {
              action: `${resourceName}.drawer.${actionKey}`,
              resource: resourceName,
              targetId: id,
            },
            config.auth.userId,
          ),
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
    });
  };
}
