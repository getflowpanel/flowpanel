import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { resolveLink } from "../runtime/resolve-link";
import { wireViews } from "../runtime/saved-views";
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

const users = resource(
  { __name: "user" },
  {
    columns: ["id"],
    views: [
      { name: "New this week", filters: { createdAt: "last7d" } },
      { name: "Paying, asleep", filters: { plan: ["starter", "pro"], daysSinceSeen: { gte: 7 } } },
      {
        name: "No Telegram",
        filters: { telegramLinked: false },
        sort: { field: "id", dir: "desc" },
      },
      { name: "Everyone", filters: { isTest: null } },
    ],
  },
);

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [users],
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

const params = (href: string | undefined) => new URL(href ?? "", "http://x").searchParams;

describe("link filter values", () => {
  it("writes ranges and sets in the list's own URL grammar", () => {
    const href = resolveLink(config, ctx, {
      resource: "user",
      filter: {
        createdAt: { gte: new Date("2026-09-01T00:00:00Z") },
        age: { gte: 18, lte: 30 },
        plan: ["starter", "pro"],
      },
    });
    expect(params(href).get("f_createdAt")).toBe("2026-09-01T00:00:00.000Z~");
    expect(params(href).get("f_age")).toBe("18:30");
    expect(params(href).get("f_plan")).toBe("starter,pro");
  });

  it("applies a view whose values are not strings", () => {
    const href = resolveLink(config, ctx, { resource: "user", view: "Paying, asleep" });
    expect(params(href).get("f_plan")).toBe("starter,pro");
    expect(params(href).get("f_daysSinceSeen")).toBe("7:");
  });

  it("throws on a value with no URL form", () => {
    expect(() =>
      resolveLink(config, ctx, { resource: "user", filter: { plan: { any: "pro" } } }),
    ).toThrow(/has no URL form/);
  });

  it("writes ctx.link filters through the same encoder", () => {
    const href = ctx.link({
      resource: "user",
      filter: {
        age: { gte: 7 },
        plan: ["starter", "pro"],
        createdAt: new Date("2026-09-24T12:00:00Z"),
      },
    });
    expect(params(href).get("f_age")).toBe("7:");
    expect(params(href).get("f_plan")).toBe("starter,pro");
    expect(params(href).get("f_createdAt")).toBe("2026-09-24");
  });
});

describe("wireViews", () => {
  it("hands the saved-views menu every filter in its URL form", () => {
    expect(wireViews(users, "UTC")).toEqual([
      { name: "New this week", filters: { createdAt: "last7d" } },
      { name: "Paying, asleep", filters: { plan: "starter,pro", daysSinceSeen: "7:" } },
      {
        name: "No Telegram",
        filters: { telegramLinked: "false" },
        sort: { field: "id", dir: "desc" },
      },
      { name: "Everyone", filters: { isTest: "" } },
    ]);
  });
});
