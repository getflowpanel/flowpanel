import type { Adapter } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildNav, resourceNavName } from "../runtime/nav.js";

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
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "jobs" }, { columns: [], plural: "Jobs" }),
      ],
    });
    const nav = buildNav(cfg);
    expect(nav).toHaveLength(1);
    expect(nav[0]?.label).toBe("Resources");
    expect(nav[0]?.items).toEqual([
      { label: "Users", href: "/admin/users" },
      { label: "Jobs", href: "/admin/jobs" },
    ]);
  });

  it("filters hidden resources", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "_internal" }, { columns: [], hidden: true }),
      ],
    });
    const nav = buildNav(cfg);
    expect(nav[0]?.items).toHaveLength(1);
  });
});
