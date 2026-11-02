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
  it("uses options.name when set", async () => {
    expect(resourceNavName({ ref: {}, options: { name: "customers" } })).toBe("customers");
  });
  it("falls back to ref.__name", async () => {
    expect(resourceNavName({ ref: { __name: "jobs" }, options: {} })).toBe("jobs");
  });
  it("falls back to Drizzle-style ref._.name", async () => {
    expect(resourceNavName({ ref: { _: { name: "orders" } }, options: {} })).toBe("orders");
  });
  it("falls back to Drizzle's Symbol(drizzle:Name)", async () => {
    const nameSym = Symbol("drizzle:Name");
    expect(resourceNavName({ ref: { [nameSym]: "payments" }, options: {} })).toBe("payments");
  });
  it("falls back to Drizzle's Symbol(drizzle:BaseName)", async () => {
    const baseNameSym = Symbol("drizzle:BaseName");
    expect(resourceNavName({ ref: { [baseNameSym]: "invoices" }, options: {} })).toBe("invoices");
  });
  it("throws instead of silently returning a literal fallback", async () => {
    expect(() => resourceNavName({ ref: {}, options: {} })).toThrow(/name/i);
  });
});

describe("buildNav", () => {
  it("uses configured group labels without changing resource links", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      labels: { navigation: { resources: "Данные" } },
      resources: [resource({ __name: "users" }, { columns: [], plural: "Пользователи" })],
    });
    expect(await buildNav(cfg)).toEqual([
      { label: "Данные", items: [{ label: "Пользователи", href: "/admin/users" }] },
    ]);
  });
  it("returns empty array when no resources", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
    });
    expect(await buildNav(cfg)).toEqual([]);
  });

  it("groups resources under 'Resources' heading, an entry without an icon taking its kind's", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users", icon: "users" }),
        resource({ __name: "jobs" }, { columns: [], plural: "Jobs" }),
      ],
    });
    const nav = await buildNav(cfg);
    expect(nav).toHaveLength(1);
    expect(nav[0]?.label).toBe("Resources");
    expect(nav[0]?.items).toEqual([
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Jobs", href: "/admin/jobs", icon: "list" },
    ]);
  });

  it("leaves a group where no entry has an icon without icons", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource({ __name: "jobs" }, { columns: [], plural: "Jobs" })],
    });
    expect((await buildNav(cfg))[0]?.items).toEqual([{ label: "Jobs", href: "/admin/jobs" }]);
  });

  it("filters hidden resources", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "internal_hidden" }, { columns: [], hidden: true }),
      ],
    });
    const nav = await buildNav(cfg);
    expect(nav[0]?.items).toHaveLength(1);
  });

  it("filters hidden queues without removing their routes", async () => {
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

    expect((await buildNav(cfg)).flatMap((group) => group.items.map((item) => item.label))).toEqual(
      ["Scrape"],
    );
    expect(cfg.queuesByKey.has("billing")).toBe(true);
  });

  it("filters every role-gated surface when a request context is provided", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "support" },
      dashboards: [
        dashboard({ path: "/", label: "Overview", sections: [] }),
        dashboard({ path: "/finance", label: "Finance", access: "admin", sections: [] }),
      ],
      pages: [
        page({ path: "/guide", label: "Guide", component: () => null }),
        page({ path: "/audit", label: "Audit", component: () => null, access: "admin" }),
      ],
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource({ __name: "secrets" }, { columns: [], access: { read: "admin" } }),
      ],
      queues: [
        queue({ name: "jobs" }, { label: "Jobs", boardUrl: "http://localhost/jobs" }),
        queue(
          { name: "billing" },
          { label: "Billing", boardUrl: "http://localhost/billing", access: "admin" },
        ),
      ],
    });
    const reqCtx = { role: "support", session: null } as RequestContext;

    expect(
      (await buildNav(cfg, reqCtx)).flatMap((group) => group.items.map((item) => item.label)),
    ).toEqual(["Overview", "Guide", "Users", "Jobs"]);
  });
});

describe("buildNav — named groups", () => {
  it("puts entries into the group they name, ordered by each group's first entry", async () => {
    const journals = { label: "Journals", collapsed: true } as const;
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      dashboards: [
        dashboard({ path: "/", label: "Pulse", sections: [] }),
        dashboard({ path: "/parsing", label: "Parsing", sections: [] }),
      ],
      resources: [
        resource({ __name: "users" }, { columns: [], plural: "Users" }),
        resource(
          { __name: "scraper_run" },
          { columns: [], plural: "Scraper runs", navGroup: journals },
        ),
        resource(
          { __name: "categories" },
          { columns: [], plural: "Categories", navGroup: "Reference" },
        ),
        resource({ __name: "ai_run" }, { columns: [], plural: "AI runs", navGroup: journals }),
      ],
    });
    expect(await buildNav(cfg)).toEqual([
      {
        label: "Dashboards",
        items: [
          { label: "Pulse", href: "/admin" },
          { label: "Parsing", href: "/admin/parsing" },
        ],
      },
      { label: "Resources", items: [{ label: "Users", href: "/admin/users" }] },
      {
        label: "Journals",
        collapsible: true,
        items: [
          { label: "Scraper runs", href: "/admin/scraper_run" },
          { label: "AI runs", href: "/admin/ai_run" },
        ],
      },
      { label: "Reference", items: [{ label: "Categories", href: "/admin/categories" }] },
    ]);
  });

  it("lets a dashboard join a resource group", async () => {
    const cfg = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      dashboards: [
        dashboard({ path: "/health", label: "Job health", sections: [], navGroup: "Ops" }),
      ],
      resources: [resource({ __name: "jobs" }, { columns: [], plural: "Jobs", navGroup: "Ops" })],
    });
    expect(await buildNav(cfg)).toEqual([
      {
        label: "Ops",
        items: [
          { label: "Job health", href: "/admin/health" },
          { label: "Jobs", href: "/admin/jobs" },
        ],
      },
    ]);
  });
});
