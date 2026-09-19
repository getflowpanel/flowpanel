import type {
  Adapter,
  ListQueryContext,
  RequestContext,
  ResourceIntrospection,
  Scope,
} from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { buildDetailTabContext, buildWidgetContext } from "../runtime/widget-context";

const columns: ResourceIntrospection["columns"] = [
  { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
  { name: "tenantId", type: "string", nullable: false, unique: false, primaryKey: false },
  { name: "deletedAt", type: "date", nullable: true, unique: false, primaryKey: false },
];

const lists: ListQueryContext<unknown>[] = [];

function baseAdapter(): Adapter {
  return {
    kind: "drizzle",
    db: { marker: true },
    introspect: (ref) => ({ name: (ref as { __name: string }).__name, columns, primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async (_ref, ctx) => {
      lists.push(ctx as ListQueryContext<unknown>);
      return { rows: [], total: 12, page: 1, pageSize: 1 };
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

function admin(adapter: Adapter, scoped = false) {
  return defineAdmin({
    ...(scoped ? { scope: async () => ({ tenantId: "t1" }) } : {}),
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "orders" },
        {
          columns: ["id"],
          delete: { softDelete: "deletedAt" },
          ...(scoped
            ? {
                scope: (tenant: Scope, query: unknown) =>
                  (query as { where: (c: unknown) => unknown }).where({
                    tenantId: tenant?.tenantId,
                  }),
              }
            : {}),
        },
      ),
      resource({ __name: "secrets" }, { columns: ["id"], requireRole: "root" }),
      resource(
        { __name: "people" },
        { columns: ["id"], fieldAccess: { tenantId: { read: "root" } } },
      ),
    ],
  });
}

function reqContext(): RequestContext {
  return {
    req: new Request("http://localhost/admin"),
    session: null,
    role: "admin",
    scope: { tenantId: "t1" },
    ip: null,
    userAgent: null,
  };
}

function contextFor(adapter: Adapter, scoped = false) {
  lists.length = 0;
  const config = admin(adapter, scoped);
  const req = new Request("http://localhost/admin");
  return buildWidgetContext(config, reqContext(), req, {
    from: new Date(0),
    to: new Date(),
    preset: "custom",
  });
}

describe("ctx.sql", () => {
  it("hands the adapter the literals and the values, untouched", async () => {
    const adapter = baseAdapter();
    const query = vi.fn().mockResolvedValue([{ n: 1 }]);
    adapter.sql = query;
    const ctx = contextFor(adapter);
    const hostile = "x'; drop table orders; --";
    expect(await ctx.sql<{ n: number }>`select count(*) as n where a = ${hostile}`).toEqual([
      { n: 1 },
    ]);
    const [strings, ...values] = query.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect([...strings]).toEqual(["select count(*) as n where a = ", ""]);
    expect(values).toEqual([hostile]);
  });

  it("names the missing capability when the adapter has no sql", () => {
    const ctx = contextFor(baseAdapter());
    expect(() => ctx.sql`select 1`).toThrow(/implements no `sql` capability/);
    expect(() => ctx.sql`select 1`).toThrow(/"drizzle"/);
  });
});

describe("ctx.count", () => {
  it("uses the adapter's own count, excluding soft-deleted rows", async () => {
    const adapter = baseAdapter();
    const count = vi.fn().mockResolvedValue(4);
    adapter.count = count;
    const ctx = contextFor(adapter);
    expect(await ctx.count("orders", { id: "o1" })).toBe(4);
    expect(count).toHaveBeenCalledWith({ __name: "orders" }, { id: "o1", deletedAt: "__null__" });
    expect(lists).toHaveLength(0);
  });

  it("falls back to a list with an empty projection and reads its total", async () => {
    const ctx = contextFor(baseAdapter());
    expect(await ctx.count("orders")).toBe(12);
    expect(lists).toHaveLength(1);
    expect(lists[0]).toMatchObject({ select: [], page: 1, pageSize: 1 });
  });

  it("keeps a scoped resource on the authorized list path, not the bare capability", async () => {
    const adapter = baseAdapter();
    const count = vi.fn().mockResolvedValue(99);
    adapter.count = count;
    const ctx = contextFor(adapter, true);
    expect(await ctx.count("orders")).toBe(12);
    expect(count).not.toHaveBeenCalled();
    expect(lists[0]).toMatchObject({ select: [] });
  });

  it("counts zero for a resource the session may not read", async () => {
    const adapter = baseAdapter();
    adapter.count = vi.fn().mockResolvedValue(5);
    const ctx = contextFor(adapter);
    expect(await ctx.count("secrets")).toBe(0);
  });

  it("refuses to count by a field the role may not read, on either path", async () => {
    const withCapability = baseAdapter();
    const count = vi.fn().mockResolvedValue(42);
    withCapability.count = count;
    expect(await contextFor(withCapability).count("people", { tenantId: "t1" })).toBe(0);
    expect(count).not.toHaveBeenCalled();
    expect(lists).toHaveLength(0);

    expect(await contextFor(baseAdapter()).count("people", { tenantId: "t1" })).toBe(0);
    expect(lists).toHaveLength(0);
  });

  it("treats an undefined filter value as no match, not as no filter, on either path", async () => {
    const withCapability = baseAdapter();
    const count = vi.fn().mockResolvedValue(42);
    withCapability.count = count;
    expect(await contextFor(withCapability).count("orders", { id: undefined })).toBe(0);
    expect(count).not.toHaveBeenCalled();

    expect(await contextFor(baseAdapter()).count("orders", { id: undefined })).toBe(0);
    expect(lists).toHaveLength(0);
  });

  it("lets the caller's own soft-delete term stand instead of overriding it", async () => {
    const adapter = baseAdapter();
    const count = vi.fn().mockResolvedValue(3);
    adapter.count = count;
    expect(await contextFor(adapter).count("orders", { deletedAt: "__notnull__" })).toBe(3);
    expect(count).toHaveBeenCalledWith({ __name: "orders" }, { deletedAt: "__notnull__" });
  });

  it("names the registered resources when the name is unknown", async () => {
    const ctx = contextFor(baseAdapter());
    await expect(ctx.count("ordrs")).rejects.toThrow(/Registered: orders, secrets, people/);
  });
});

describe("a detail tab's context", () => {
  it("carries the same sql and count", async () => {
    const adapter = baseAdapter();
    adapter.sql = vi.fn().mockResolvedValue([]);
    const config = admin(adapter);
    const ctx = buildDetailTabContext(config, reqContext(), new Request("http://localhost/admin"), {
      id: "o1",
    });
    expect(await ctx.sql`select 1`).toEqual([]);
    expect(await ctx.count("orders")).toBe(12);
  });
});
