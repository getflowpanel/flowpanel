import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, metric, resource } from "@flowpanel/core";
import { WidgetErrorBoundary } from "@flowpanel/next/client";
import { ErrorCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";
import { renderSlots } from "../pages/detail-page/widget-slots";
import { renderWidgetsTab } from "../pages/detail-tabs/render-widgets-tab";
import { resolveLink } from "../runtime/resolve-link";
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
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource({ __name: "scraper_run" }, { columns: ["id"], views: [{ name: "Errors" }] }),
  ],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

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

describe("a widget that fails on a record page", () => {
  it("names itself in its error card, its boundary and the server log", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const tab = {
      key: "summary",
      label: "Summary",
      widgets: [
        metric("Broken", async () => {
          throw new Error("boom");
        }),
      ],
    };
    const tree = await renderWidgetsTab(
      config,
      reqCtx,
      { id: "r1" },
      tab,
      reqCtx.req,
      "id",
      "scraper_run",
    );
    const name = '«Broken» (metric, scraper_run tab "summary" widget 1)';
    expect((findProps(tree, ErrorCard)!.error as Error).message).toBe(`${name}: boom`);
    expect(findProps(tree, WidgetErrorBoundary)?.widgetId).toBe(name);
    expect(findProps(tree, ErrorCard)?.title).toBe("Broken");
    expect(findProps(tree, WidgetErrorBoundary)?.title).toBe("Broken");
    expect(String(error.mock.calls[0]?.[0])).toContain(`[flowpanel] widget ${name} failed`);
    error.mockRestore();
  });

  it("drops its error card's frame when it fails inside the stats strip", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = metric("Broken", async () => {
      throw new Error("boom");
    });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, {
      from: new Date("2026-09-14T00:00:00Z"),
      to: new Date("2026-09-21T00:00:00Z"),
      preset: "last7d",
    });
    const stats = async (plain: boolean) =>
      (await renderSlots([broken], ctx, config, reqCtx, "stats", { plain }))[0]?.node;
    expect(findProps(await stats(true), ErrorCard)?.plain).toBe(true);
    expect(findProps(await stats(false), ErrorCard)?.plain).toBeUndefined();
    error.mockRestore();
  });
});

function slotOf(tree: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = slotOf(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if ("owner" in el.props) return el;
  return slotOf(el.props.children);
}

describe("a widget on a dashboard", () => {
  it("names its boundary by its 1-based section and place", async () => {
    const page = await DashboardPage({
      config,
      dashboard: {
        path: "/system",
        label: "System",
        sections: [{ widgets: [metric("Runs", async () => 1)] }],
      },
      searchParams: new URLSearchParams(""),
      req: reqCtx.req,
      reqCtx,
    });
    const slot = slotOf(page);
    const rendered = (slot!.type as (props: Record<string, unknown>) => ReactNode)(
      slot?.props ?? {},
    );
    expect(findProps(rendered, WidgetErrorBoundary)?.widgetId).toBe(
      "«Runs» (metric, /system section 1 widget 1)",
    );
    expect(findProps(rendered, WidgetErrorBoundary)?.title).toBe("Runs");
  });
});

describe("a function link to a name that does not exist", () => {
  const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, {
    from: new Date("2026-09-14T00:00:00Z"),
    to: new Date("2026-09-21T00:00:00Z"),
    preset: "last7d",
  });

  it("suggests the closest resource, view or dashboard when it renders", () => {
    expect(() => resolveLink(config, ctx, () => ({ resource: "scraper_rn" }))).toThrow(
      /no such resource\. Did you mean "scraper_run"\?/,
    );
    expect(() =>
      resolveLink(config, ctx, () => ({ resource: "scraper_run", view: "Erors" })),
    ).toThrow(/no such view\. Did you mean "Errors"\?/);
    expect(() => resolveLink(config, ctx, () => ({ dashboard: "/sytem" }))).toThrow(
      /no such dashboard or page\. Registered: none\./,
    );
  });
});
