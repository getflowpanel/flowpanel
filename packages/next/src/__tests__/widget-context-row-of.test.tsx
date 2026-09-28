import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource, stat } from "@flowpanel/core";
import { StatCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidgetsTab } from "../pages/detail-tabs/render-widgets-tab";
import {
  buildDetailTabContext,
  buildWidgetContext,
  detailTabDateRange,
} from "../runtime/widget-context";

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
    resource({ __name: "user" }, { columns: ["id", "email"] }),
    resource({ __name: "order" }, { columns: ["id"] }),
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

const row = { id: "u1", email: "ann@example.com" };
const history = detailTabDateRange();

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

describe("ctx.rowOf", () => {
  it("returns the viewed record on its own resource's card", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, history, row, "id", "user");
    expect(ctx.rowOf("user")).toBe(row);
  });

  it("throws on a dashboard, where there is no record", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, history);
    expect(() => ctx.rowOf("user")).toThrow(
      /ctx\.rowOf\("user"\) — this widget has no record; it sits on a dashboard\. Read rows with ctx\.read\("user", \{ where \}\)/,
    );
  });

  it("throws on another resource's card, naming both", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, history, row, "id", "order");
    expect(() => ctx.rowOf("user")).toThrow(
      /ctx\.rowOf\("user"\) — this widget sits on a "order" card, not a "user" card/,
    );
  });

  it("returns the record when the context does not know its resource", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, history, row);
    expect(ctx.rowOf("user")).toBe(row);
  });

  it("reaches a DetailTab.render context", () => {
    const ctx = buildDetailTabContext(config, reqCtx, reqCtx.req, row, "id", "user");
    expect(ctx.rowOf("user").email).toBe("ann@example.com");
  });

  it("reaches the widgets of a widgets tab", async () => {
    const tab = {
      key: "summary",
      label: "Summary",
      widgets: [stat("Email", async (c) => String(c.rowOf("user").email))],
    };
    const tree = await renderWidgetsTab(config, reqCtx, row, tab, reqCtx.req, "id", "user");
    expect(findProps(tree, StatCard)?.value).toBe("ann@example.com");
  });
});
