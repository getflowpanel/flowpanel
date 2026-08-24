// LOC-OK: GET drawer payload + POST drawer action share the same DrawerRouteCtx
import type {
  ColumnFormat,
  DrawerAction,
  DrawerConfig,
  DrawerFieldList,
  DrawerTab,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import { humanize, runWithRequestContext } from "@flowpanel/core";
import { createElement, Fragment, type ReactNode } from "react";
import {
  actorIdFromSession,
  buildAuditEvent,
  filterActionsByAccess,
  invalidJsonResponse,
  maybeEmitAudit,
  notFoundResponse,
  parseActionInputSchema,
  readActionInput,
} from "../runtime/action-helpers.js";
import { applyActionResult } from "../runtime/apply-action-result.js";
import { buildHref } from "../runtime/href.js";
import { projectAuthorizedRow } from "../runtime/project-row.js";
import { bindPublisher, publish } from "../runtime/publish.js";
import { readRelatedRows } from "../runtime/require-authorized.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { withGuards } from "../runtime/with-guards.js";
import { type SerializedWidget, serializeWidget } from "./serialize-widget.js";

export type { SerializedWidget };

/** Wire-safe shape of `DrawerAction`. */
export interface SerializedDrawerAction {
  key: string;
  label: string;
  variant?: "default" | "destructive";
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
  /** The resource's display label, so the drawer never shows the raw registry name. */
  resourceLabel: string;
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

/** Flatten a declared drawer field list to the wire shape. */
function serializeFields(fields: DrawerFieldList<Record<string, unknown>>): "*" | string[] {
  if (fields === "*") return "*";
  return fields
    .map((f) => (typeof f === "object" && f !== null ? f.name : String(f)))
    .filter((f) => f !== "");
}

function serializeAction(a: DrawerAction): SerializedDrawerAction {
  const out: SerializedDrawerAction = { key: a.key, label: a.label };
  if (a.variant !== undefined) out.variant = a.variant;
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
    return { kind: "fields", key: tab.key, label: tab.label, fields: serializeFields(tab.fields) };
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
      widgets.push(await serializeWidget(w, config, reqCtx, widgetCtx));
    }
    return { kind: "widgets", key: tab.key, label: tab.label, widgets };
  }
  const target = config.resourcesByName.get(tab.resource);
  const rows = target
    ? await readRelatedRows(config, target, reqCtx, {
        filters: typeof tab.filter === "function" ? tab.filter(row) : {},
        pageSize: 20,
      })
    : null;
  if (!target || !rows) {
    return {
      kind: "resource",
      key: tab.key,
      label: tab.label,
      resource: tab.resource,
      rows: [],
      columns: [],
    };
  }
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
    rows,
    columns: columns.filter((c) => c),
  };
}

export interface DrawerRouteCtx {
  params: Promise<{ resource: string; id: string }>;
}

/** Factory producing the Next.js route handler for `/api/flowpanel/drawer/[resource]/[id]`. */
export function drawerRoute(config: ResolvedAdminConfig) {
  bindPublisher(config);
  return async function GET(req: Request, ctx: DrawerRouteCtx): Promise<Response> {
    const { resource: resourceName, id } = await ctx.params;
    const resource = config.resourcesByName.get(resourceName);
    if (!resource) {
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    const drawer: DrawerConfig | undefined = resource.options.drawer;
    if (!drawer) {
      return Response.json(
        { ok: false, error: `resource "${resourceName}" has no drawer config` },
        { status: 400 },
      );
    }

    return withGuards(
      config,
      req,
      { resource, operation: "read", write: false },
      async (reqCtx) => {
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
          row: await projectAuthorizedRow(resource, row, reqCtx),
          header,
          resourceLabel:
            (resource.options.label as string | undefined) ?? humanize(String(resourceName)),
          width: drawer.width ?? "lg",
          fields: serializeFields(drawer.fields ?? "*"),
          tabs,
          actions: (await filterActionsByAccess(drawer.actions, reqCtx)).map(serializeAction),
          prerendered: await prerenderRowFields(columns, row, reqCtx),
          labels: buildFieldLabels(columns),
          formats: buildFieldFormats(columns),
        };
        return Response.json(payload);
      },
    );
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
      return notFoundResponse("resource", resourceName, [...config.resourcesByName.keys()]);
    }
    const actions = resource.options.drawer?.actions;
    const action = actions?.find((a) => a.key === actionKey);
    if (!action) {
      return notFoundResponse(
        "action",
        actionKey,
        (actions ?? []).map((a) => a.key),
      );
    }

    return withGuards(
      config,
      req,
      { resource, actionAccess: action.access, actionRequireRole: action.requireRole },
      async (reqCtx) => {
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
        if (action.when) {
          const allowed = await action.when({ ...reqCtx, current: row, input: {} });
          if (!allowed) {
            return Response.json({ ok: false, error: "not found" }, { status: 404 });
          }
        }

        const body = await readActionInput(req);
        if (!body.ok) return invalidJsonResponse();
        const parsedInput = await parseActionInputSchema(
          action.form as Parameters<typeof parseActionInputSchema>[0],
          undefined,
          body.input,
        );
        if (parsedInput.issues) {
          return Response.json(
            { ok: false, error: "validation failed", issues: parsedInput.issues },
            { status: 422 },
          );
        }

        const actionCtx = {
          ...reqCtx,
          db: config.adapter.db,
          ...(action.unsafe?.includes("db") ? { unsafe: { db: config.adapter.db } } : {}),
          actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
          publish: async (channel: string, payload?: unknown) => {
            await publish(channel, payload);
          },
        };

        const result = await runWithRequestContext(reqCtx, () =>
          action.run(row, parsedInput.data, actionCtx),
        );

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
      },
    );
  };
}
