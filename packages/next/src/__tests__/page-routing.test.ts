import type { Adapter } from "@flowpanel/core";
import { defineAdmin, page, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildNav } from "../runtime/nav";
import { matchPage } from "../runtime/page-routing";

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

function CostDeepDive() {
  return null;
}

function Reports() {
  return null;
}

describe("pages — empty / undefined", () => {
  it("no pages → no Pages nav group, matchPage returns null", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
    });
    expect(cfg.pagesByPath.size).toBe(0);
    expect(matchPage(["foo"], cfg)).toBeNull();
    expect(matchPage([], cfg)).toBeNull();
    const nav = buildNav(cfg);
    expect(nav.find((g) => g.label === "Pages")).toBeUndefined();
  });

  it("pages: [] resolves to empty map and no nav group", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [],
    });
    expect(cfg.pagesByPath.size).toBe(0);
    expect(buildNav(cfg).find((g) => g.label === "Pages")).toBeUndefined();
  });
});

describe("pages — registered with component", () => {
  it("matchPage resolves the page for a single-segment slug", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/cost-deep-dive", label: "Cost analytics", component: CostDeepDive })],
    });
    const p = matchPage(["cost-deep-dive"], cfg);
    expect(p).not.toBeNull();
    expect(p?.label).toBe("Cost analytics");
    expect(p?.component).toBe(CostDeepDive);
  });

  it("buildNav contains a 'Pages' group with the page label and basePath-aware href", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/cost-deep-dive", label: "Cost analytics", component: CostDeepDive })],
    });
    const nav = buildNav(cfg);
    const pagesGroup = nav.find((g) => g.label === "Pages");
    expect(pagesGroup).toBeDefined();
    expect(pagesGroup?.items).toEqual([{ label: "Cost analytics", href: "/admin/cost-deep-dive" }]);
  });

  it("honors a custom basePath when building the page href", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      basePath: "/internal/admin",
      pages: [page({ path: "/reports", label: "Reports", component: Reports })],
    });
    const nav = buildNav(cfg);
    const pagesGroup = nav.find((g) => g.label === "Pages");
    expect(pagesGroup?.items[0]?.href).toBe("/internal/admin/reports");
  });

  it("matches a page registered at '/' against an empty slug", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/", label: "Home", component: Reports })],
    });
    expect(matchPage([], cfg)?.label).toBe("Home");
  });

  it("normalizes a trailing slash on a page path", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/reports/", label: "Reports", component: Reports })],
    });
    expect(matchPage(["reports"], cfg)?.label).toBe("Reports");
  });

  it("returns null when the slug does not match any registered page", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/cost-deep-dive", label: "Cost", component: CostDeepDive })],
    });
    expect(matchPage(["unknown"], cfg)).toBeNull();
  });
});

describe("pages — external href entries", () => {
  it("nav entry uses page.href when no component is supplied", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/docs", label: "Docs", href: "https://docs.example.com" })],
    });
    const nav = buildNav(cfg);
    expect(nav.find((g) => g.label === "Pages")?.items[0]?.href).toBe("https://docs.example.com");
  });

  it("matchPage returns null for href-only entries (FlowPanel does not render them)", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      pages: [page({ path: "/docs", label: "Docs", href: "https://docs.example.com" })],
    });
    expect(matchPage(["docs"], cfg)).toBeNull();
  });
});

describe("pages — collisions", () => {
  it("throws on duplicate page paths", () => {
    expect(() =>
      defineAdmin({
        adapter: fakeAdapter,
        auth: { session: async () => null, role: () => "guest" },
        pages: [
          page({ path: "/x", label: "First", component: Reports }),
          page({ path: "/x", label: "Second", component: CostDeepDive }),
        ],
      }),
    ).toThrow(/Duplicate page path/);
  });

  it("throws when a page path collides with a dashboard path", () => {
    expect(() =>
      defineAdmin({
        adapter: fakeAdapter,
        auth: { session: async () => null, role: () => "guest" },
        dashboards: [{ path: "/overview", label: "Overview", sections: [] }],
        pages: [page({ path: "/overview", label: "Page", component: Reports })],
      }),
    ).toThrow(/collides with a dashboard/);
  });
});

describe("pages — alongside resources", () => {
  it("pages, dashboards, and resources all appear in nav with stable group order", () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      dashboards: [{ path: "/", label: "Home", sections: [] }],
      pages: [page({ path: "/reports", label: "Reports", component: Reports })],
      resources: [resource({ __name: "users" }, { columns: [], plural: "Users" })],
    });
    const nav = buildNav(cfg);
    expect(nav.map((g) => g.label)).toEqual(["Dashboards", "Pages", "Resources"]);
  });
});
