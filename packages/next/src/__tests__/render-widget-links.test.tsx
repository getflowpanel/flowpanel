import type { Adapter, RequestContext, WidgetConfig } from "@flowpanel/core";
import { dashboard, defineAdmin, resource } from "@flowpanel/core";
import {
  KvCard,
  ListCard,
  MetricCard,
  StatCard,
  StatGroupCard,
  TableWidget,
} from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { serializeCardWidget } from "../drawer/serialize-cards";
import { serializeWidget } from "../drawer/serialize-widget";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource(
      { __name: "ai_run" },
      { columns: ["id"], views: [{ name: "Ошибки", filters: { status: "error" } }] },
    ),
  ],
  dashboards: [dashboard({ path: "/system", label: "System", sections: [] })],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, {
  from: new Date("2026-09-14T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last7d",
});
const errors = { resource: "ai_run", view: "Ошибки" } as const;

function findProps(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findProps(child, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === target) return el.props;
  return findProps(el.props.children, target);
}

describe("named links on widget options", () => {
  it("resolves a metric drilldown that names a view", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Failed",
      query: async () => 3,
      options: { drilldown: errors },
    };
    const props = findProps(await renderWidget(widget, ctx, config, reqCtx), MetricCard);
    expect(props?.drilldown).toBe("/admin/ai_run?f_status=error");
  });

  it("resolves a stat href computed from the context, and lets a StatResult href win", async () => {
    const computed: WidgetConfig = {
      kind: "stat",
      label: "Health",
      value: 1,
      options: { href: (c) => ({ dashboard: "/system", range: c.dateRange.preset !== "custom" }) },
    };
    expect(findProps(await renderWidget(computed, ctx, config, reqCtx), StatCard)?.href).toBe(
      "/admin/system?preset=last7d",
    );
    const fromResult: WidgetConfig = {
      kind: "stat",
      label: "Health",
      value: async () => ({ value: 1, href: errors }),
      options: { href: "https://status.example.com" },
    };
    expect(findProps(await renderWidget(fromResult, ctx, config, reqCtx), StatCard)?.href).toBe(
      "/admin/ai_run?f_status=error",
    );
  });

  it("resolves a statGroup item's link on the dashboard and in the drawer", async () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: {
        stats: [{ label: "Runs", value: async () => ({ value: 2, href: { resource: "ai_run" } }) }],
      },
    };
    expect(
      findProps(await renderWidget(widget, ctx, config, reqCtx), StatGroupCard)?.stats,
    ).toEqual([{ label: "Runs", value: 2, href: "/admin/ai_run" }]);
    expect(await serializeWidget(widget, config, reqCtx, ctx)).toMatchObject({
      kind: "statGroup",
      stats: [{ label: "Runs", value: 2, href: "/admin/ai_run" }],
    });
  });

  it("resolves a kv item's link", async () => {
    const widget: WidgetConfig = {
      kind: "kv",
      options: { items: [{ label: "Runs", value: 2, href: { resource: "ai_run" } }] },
    };
    expect(findProps(await renderWidget(widget, ctx, config, reqCtx), KvCard)?.items).toEqual([
      { label: "Runs", value: "2", href: "/admin/ai_run" },
    ]);
  });

  it("resolves every list row's link and keeps a row without one plain", async () => {
    const widget: WidgetConfig = {
      kind: "list",
      options: {
        query: async () => [
          { text: "Failing runs", href: errors },
          { text: "Status page", href: "https://status.example.com" },
          { text: "Plain" },
        ],
      },
    };
    expect(findProps(await renderWidget(widget, ctx, config, reqCtx), ListCard)?.rows).toEqual([
      { text: "Failing runs", href: "/admin/ai_run?f_status=error" },
      { text: "Status page", href: "https://status.example.com" },
      { text: "Plain" },
    ]);
  });

  it("links a table heading and its rows to named targets", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: {
        query: async () => [{ id: "r1" }],
        columns: ["id"],
        seeAll: errors,
        rowHref: (row) => ({ resource: "ai_run", id: String((row as { id: string }).id) }),
      },
    };
    const props = findProps(await renderWidget(widget, ctx, config, reqCtx), TableWidget);
    expect(props?.seeAllHref).toBe("/admin/ai_run?f_status=error");
    expect(props?.hrefs).toEqual(["/admin/ai_run/r1"]);
  });

  it("hands a chart its resolved drilldown and never the option itself", async () => {
    const widget = {
      kind: "areaChart",
      label: "Runs",
      query: async () => [],
      options: { x: "day", y: "n", drilldown: () => ({ resource: "ai_run" }) },
    } as unknown as WidgetConfig;
    const node = await renderWidget(widget, ctx, config, reqCtx);
    const renderer = (node as ReactElement<{ children: ReactNode[] }>).props
      .children[0] as ReactElement<{ drilldown?: string; options: Record<string, unknown> }>;
    expect(renderer.props.drilldown).toBe("/admin/ai_run");
    expect("drilldown" in renderer.props.options).toBe(false);
  });

  it("resolves drawer card links on the server", async () => {
    const widget: WidgetConfig = {
      kind: "bars",
      options: {
        query: async () => [
          { label: "kwork", value: 3, href: { resource: "ai_run", filter: { platform: "kwork" } } },
        ],
      },
    };
    expect(await serializeCardWidget(widget, config, reqCtx, ctx)).toMatchObject({
      kind: "bars",
      rows: [{ label: "kwork", value: 3, href: "/admin/ai_run?f_platform=kwork" }],
    });
  });
});
