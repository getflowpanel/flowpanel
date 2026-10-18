import { describe, expect, it } from "vitest";
import type { Adapter, ColumnMeta } from "../index";
import { defineAdmin, page, resource } from "../index";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: false,
  unique: false,
  primaryKey: name === "id",
});

const TABLES: Record<string, string[]> = {
  customers: ["id", "name", "email"],
  monitors: ["id", "url", "customerId"],
};

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    const name = String(Reflect.get(Object(ref), "__name"));
    return { name, columns: (TABLES[name] ?? []).map(meta), primaryKey: "id" };
  },
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const auth = { session: async () => null, role: () => "guest" };

function admin(customers: Record<string, unknown>, monitors: Record<string, unknown> = {}) {
  return defineAdmin({
    adapter,
    auth,
    resources: [
      resource({ __name: "customers" }, { columns: ["id", "name"], ...customers } as never),
      resource({ __name: "monitors" }, { columns: ["id", "url"], ...monitors } as never),
    ],
  });
}

describe("defineAdmin names a typo TypeScript would catch, for plain JavaScript and casts", () => {
  it("in search", () => {
    expect(() => admin({ search: ["email", "nmae"] })).toThrow(
      /resource "customers" search\[1\]: it points at column "nmae".*Did you mean "name"\?/s,
    );
  });

  it("in a reference's labelField", () => {
    expect(() =>
      admin(
        {},
        {
          columns: [
            "id",
            { field: "customerId", reference: { resource: "customers", labelField: "nam" } },
          ],
        },
      ),
    ).toThrow(
      /resource "monitors" columns\[1\]\.reference\.labelField: it names column "nam" on "customers", which does not exist\. Did you mean "name"\? Known: "id", "name", "email"\./,
    );
  });

  it("in a filter type", () => {
    expect(() => admin({ filters: [{ field: "name", type: "selct" }] })).toThrow(
      /resource "customers" filters\[0\]\.type: it names filter type "selct", which does not exist\. Did you mean "select"\?/,
    );
  });

  it("in a column format, written as a word or as a kind", () => {
    expect(() => admin({ columns: ["id", { field: "name", format: "bool" }] })).toThrow(
      /resource "customers" columns\[1\]\.format: it names column format "bool", which does not exist\./,
    );
    expect(() => admin({ columns: ["id", { field: "name", format: { kind: "mony" } }] })).toThrow(
      /columns\[1\]\.format\.kind: it names column format "mony".*Did you mean "money"\?/s,
    );
  });

  it("accepts every documented filter type and format", () => {
    expect(() =>
      admin({
        columns: [
          "id",
          { field: "name", format: "badge" },
          { field: "email", format: { kind: "url" } },
        ],
        filters: [
          { field: "name", type: "multiselect", options: ["a"] },
          { field: "email", type: "text" },
        ],
        search: ["name", "email"],
      }),
    ).not.toThrow();
  });
});

describe("defineAdmin tells a dashboard from a page", () => {
  it("names pages: [...] when a page() lands in dashboards", () => {
    const misplaced = [page({ path: "/reports", label: "Reports", component: () => null })];
    expect(() => defineAdmin({ adapter, auth, dashboards: misplaced as never })).toThrow(
      /dashboards\[0\]: it is a page\(\)\. Register pages under pages: \[\.\.\.\]/,
    );
  });

  it("names the missing sections of a dashboard", () => {
    const bare = [{ path: "/", label: "Overview" }];
    expect(() => defineAdmin({ adapter, auth, dashboards: bare as never })).toThrow(
      /dashboards\[0\]: it has no sections\./,
    );
  });

  it("serves a page() from pages", () => {
    const admin = defineAdmin({
      adapter,
      auth,
      pages: [page({ path: "/reports", label: "Reports", component: () => null })],
    });
    expect(admin.pagesByPath.get("/reports")?.label).toBe("Reports");
  });
});

describe("defineAdmin under a global scope", () => {
  it("names the resource that has no scope of its own at boot", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        scope: () => ({ orgId: 1 }),
        resources: [resource({ __name: "customers" }, { columns: ["id"] })],
      }),
    ).toThrow(
      /resource "customers" scope: the admin has a global scope, so every resource needs its own/,
    );
  });

  it("accepts a resource that opts out with bypass", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth,
        scope: () => ({ orgId: 1 }),
        resources: [resource({ __name: "customers" }, { columns: ["id"], scope: "bypass" })],
      }),
    ).not.toThrow();
  });
});
