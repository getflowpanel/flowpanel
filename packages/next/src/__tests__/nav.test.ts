import type { Adapter, RequestContext } from "@flowpanel/core";
import { dashboard, defineAdmin, page, queue, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildNav, resourceNavName } from "../runtime/nav";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {} as never, update: {} as never, select: {} as never }) as ReturnType<
      Adapter["inferSchema"]
    >,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

describe("resourceNavName", () => {
  it("uses options.name when set", () => {
    expect(resourceNavName({ ref: {}, options: { name: "customers" } })).toBe("customers");
  });
  it("falls back to ref.__name", () => {
    expect(resourceNavName({ ref: { __name: "jobs" }, options: {} })).toBe("jobs");
  });
  it("falls back to Drizzle-style ref._.name", () => {
    expect(resourceNavName({ ref: { _: { name: "orders" } }, options: {} })).toBe("orders");
  });
  it("falls back to Drizzle's Symbol(drizzle:Name)", () => {
    const nameSym = Symbol("drizzle:Name");
    expect(resourceNavName({ ref: { [nameSym]: "payments" }, options: {} })).toBe("payments");
  });
  it("falls back to Drizzle's Symbol(drizzle:BaseName)", () => {
    const baseNameSym = Symbol("drizzle:BaseName");
    expect(resourceNavName({ ref: { [baseNameSym]: "invoices" }, options: {} })).toBe("invoices");
  });
  it("throws instead of silently returning a literal fallback", () => {
    expect(() => resourceNavName({ ref: {}, options: {} })).toThrow(/name/i);
  });
});

describe("buildNav", () => {
  it("returns empty array when no resources", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
    });
    expect(buildNav(cfg)).toEqual([]);
  });

  it("groups resources under 'Resources' heading", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users", icon: "users" }),
        resource({ __name: "jobs" }, { columns: [], plural: "Jobs" }),
      ],
    });
    const nav = buildNav(cfg);
    expect(nav).toHaveLength(1);
    expect(nav[0]?.label).toBe("Resources");
    expect(nav[0]?.items).toEqual([
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Jobs", href: "/admin/jobs" },
    ]);
  });

  it("filters hidden resources", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "internal_hidden" }, { columns: [], hidden: true }),
      ],
    });
    const nav = buildNav(cfg);
    expect(nav[0]?.items).toHaveLength(1);
  });

  it("filters hidden queues without removing their routes", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      queues: [
        queue({ name: "scrape" }, { label: "Scrape", boardUrl: "http://localhost/scrape" }),
        queue(
          { name: "billing" },
          { label: "Billing", boardUrl: "http://localhost/billing", hidden: true },
        ),
      ],
    });

    expect(buildNav(cfg).flatMap((group) => group.items.map((item) => item.label))).toEqual([
      "Scrape",
    ]);
    expect(cfg.queuesByKey.has("billing")).toBe(true);
  });

  it("filters every role-gated surface when a request context is provided", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "support" },
      dashboards: [
        dashboard({ path: "/", label: "Overview", sections: [] }),
        dashboard({ path: "/finance", label: "Finance", requireRole: "admin", sections: [] }),
      ],
      pages: [
        page({ path: "/guide", label: "Guide", component: () => null }),
        page({ path: "/audit", label: "Audit", component: () => null, requireRole: "admin" }),
      ],
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "secrets" }, { columns: [], requireRole: "admin" }),
      ],
      queues: [
        queue({ name: "jobs" }, { label: "Jobs", boardUrl: "http://localhost/jobs" }),
        queue(
          { name: "billing" },
          { label: "Billing", boardUrl: "http://localhost/billing", requireRole: "admin" },
        ),
      ],
    });
    const reqCtx = { role: "support", session: null } as RequestContext;

    expect(buildNav(cfg, reqCtx).flatMap((group) => group.items.map((item) => item.label))).toEqual(
      ["Overview", "Guide", "Users", "Jobs"],
    );
  });
});
