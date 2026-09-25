import type { Adapter, ColumnMeta, RequestContext } from "@flowpanel/core";
import { defineAdmin, metric, resource } from "@flowpanel/core";
import { MetricCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

const week = {
  from: new Date("2026-09-14T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last7d" as const,
};

const count = vi.fn<NonNullable<Adapter["count"]>>(async (_ref, where) => {
  const range = where?.createdAt as { gte: Date } | undefined;
  return range?.gte.getTime() === week.from.getTime() ? 7 : 5;
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: ["id", "status", "createdAt", "total"].map(meta),
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
  count,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource(
      { __name: "order" },
      {
        columns: ["id", "status"],
        filters: [
          { field: "status", type: "select" },
          { field: "createdAt", type: "daterange" },
        ],
      },
    ),
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

describe("a count metric on a dashboard", () => {
  it("shows the count, compares it with the period before and links the counted rows", async () => {
    const widget = metric(
      "Paid orders",
      { count: "order", where: { status: "paid" }, range: "createdAt" },
      { compare: true },
    );
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const card = findProps(await renderWidget(widget, ctx, config, reqCtx), MetricCard);

    expect(card?.value).toBe(7);
    expect(card?.delta).toMatchObject({ previous: 5 });
    expect(count).toHaveBeenCalledTimes(2);

    const href = new URL(String(card?.drilldown), "http://x");
    expect(href.pathname).toBe("/admin/order");
    expect(href.searchParams.get("f_status")).toBe("paid");
    expect(href.searchParams.get("f_createdAt")).toBe(
      `${week.from.toISOString()}~${week.to.toISOString()}`,
    );
  });
});

describe("a count metric whose function where its list reads differently", () => {
  it("warns once in development that its link opens other rows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const widget = metric("Paid or refunded", {
      count: "order",
      where: () => ({ status: ["paid", "refunded"] }),
    });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    await renderWidget(widget, ctx, config, reqCtx);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /metric "Paid or refunded" counts "order" by "status", but the list reads "status" through a "select" filter, and this value needs a "multiselect" filter there/,
    );
    warn.mockRestore();
  });

  it("warns once in development that a field its list does not declare opens every row", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const widget = metric("Big orders", { count: "order", where: () => ({ total: 5 }) });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    await renderWidget(widget, ctx, config, reqCtx);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /metric "Big orders" counts "order" by "total", which its list does not declare, so its link opens every row/,
    );
    warn.mockRestore();
  });
});
