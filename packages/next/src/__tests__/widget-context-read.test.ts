import type { Adapter, ColumnMeta, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDetailTabContext, buildWidgetContext } from "../runtime/widget-context";

const COLUMNS: Record<string, string[]> = {
  order: ["id", "userId", "status", "total", "createdAt"],
  user: ["id", "email"],
};

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

type List = Adapter["list"];

function admin(list: List, orderRole?: string) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: (ref) => {
      const name = (ref as { __name: string }).__name;
      return { name, columns: (COLUMNS[name] ?? []).map(meta), primaryKey: "id" };
    },
    inferSchema: () => ({}) as never,
    list,
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "order" },
        {
          columns: ["id", "userId", "status"],
          ...(orderRole ? { access: { read: orderRole } } : {}),
        },
      ),
      resource({ __name: "user" }, { columns: ["id", "email"] }),
    ],
  });
}

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const week = {
  from: new Date("2026-09-14T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last7d" as const,
};

const row = { id: "o1", userId: "u1", status: "paid", total: 5 };

function listing(rows: Record<string, unknown>[] = [row]) {
  return vi.fn<List>(async () => ({ rows, total: rows.length, page: 1, pageSize: 100 }));
}

function contextFor(list: List, orderRole?: string) {
  return buildWidgetContext(admin(list, orderRole), reqCtx, reqCtx.req, week);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ctx.read", () => {
  it("reads through the resource's list once per request for the same options", async () => {
    const list = listing();
    const ctx = contextFor(list);
    const [a, b] = await Promise.all([
      ctx.read("order", { where: { userId: "u1" }, limit: 5 }),
      ctx.read("order", { limit: 5, where: { userId: "u1" } }),
    ]);
    expect(a).toEqual([{ id: "o1", userId: "u1", status: "paid" }]);
    expect(b).toBe(a);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[1]).toMatchObject({
      filters: { userId: "u1" },
      page: 1,
      pageSize: 5,
    });
  });

  it("hands the adapter its own range and set shapes", async () => {
    const list = listing();
    await contextFor(list).read("order", {
      where: { total: { gte: 10 }, status: ["paid", "refunded"], createdAt: "__notnull__" },
    });
    expect(list.mock.calls[0]?.[1].filters).toEqual({
      total: { op: "range", gte: 10 },
      status: { op: "in", values: ["paid", "refunded"] },
      createdAt: "__notnull__",
    });
  });

  it("returns the list's projection, and a field outside it only when fields asks for it", async () => {
    const list = listing();
    const ctx = contextFor(list);
    const [plain] = await ctx.read("order");
    expect(plain).not.toHaveProperty("total");
    const [wide] = await ctx.read("order", { fields: ["total"] });
    expect(wide).toHaveProperty("total", 5);
  });

  it("reads fields beyond the declared columns and sorts when asked", async () => {
    const list = listing();
    const rows = await contextFor(list).read("order", {
      fields: ["total"],
      sort: { field: "total", dir: "desc" },
    });
    expect(rows).toEqual([row]);
    expect(list.mock.calls[0]?.[1].sort).toEqual({ field: "total", dir: "desc" });
  });

  it("throws on a misspelt field, sort or read field before any query", async () => {
    const list = listing();
    const ctx = contextFor(list);
    await expect(ctx.read("order", { where: { usrId: "u1" } })).rejects.toThrow(
      /ctx\.read\("order"\) filters by "usrId".*Did you mean "userId"\?/s,
    );
    await expect(ctx.read("order", { sort: { field: "totl", dir: "asc" } })).rejects.toThrow(
      /sorts by "totl".*Did you mean "total"\?/s,
    );
    await expect(ctx.read("order", { fields: ["creatdAt"] })).rejects.toThrow(
      /reads "creatdAt".*Did you mean "createdAt"\?/s,
    );
    expect(list).not.toHaveBeenCalled();
  });

  it("throws on an undefined value instead of reading every user's rows", async () => {
    const list = listing();
    await expect(contextFor(list).read("order", { where: { userId: undefined } })).rejects.toThrow(
      /filters "userId" by undefined, which would match every row/,
    );
    expect(list).not.toHaveBeenCalled();
  });

  it("reads nothing for an empty set", async () => {
    const list = listing();
    expect(await contextFor(list).read("order", { where: { status: [] } })).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("reads 100 rows by default and at most 1000, warning once when a read fills it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const list = vi.fn<List>(async (_ref, listCtx) => ({
      rows: Array.from({ length: listCtx.pageSize }, (_, i) => ({ id: `o${i}` })),
      total: 5000,
      page: 1,
      pageSize: listCtx.pageSize,
    }));
    const ctx = contextFor(list);
    await ctx.read("order");
    await ctx.read("order", { limit: 5000 });
    await ctx.read("order", { limit: 5000, where: { status: "paid" } });
    expect(list.mock.calls.map((call) => call[1].pageSize)).toEqual([100, 1000, 1000]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/ctx\.read\("order"\) returned 1000 rows/);
  });

  it("reads [] from a resource the session may not read", async () => {
    const list = listing();
    expect(await contextFor(list, "owner").read("order")).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("names the closest resource for a typo, in read and in count", async () => {
    const ctx = contextFor(listing());
    await expect(ctx.read("oder")).rejects.toThrow(
      /ctx\.read\("oder"\) — no such resource\. Did you mean "order"\?/,
    );
    await expect(ctx.count("usr")).rejects.toThrow(
      /ctx\.count\("usr"\) — no such resource\. Did you mean "user"\?/,
    );
    await expect(ctx.read("user_visit")).rejects.toThrow(
      /If "user_visit" is a table in your schema, register it: resource\(schema\.<table>, \{ hidden: true \}\)\./,
    );
  });

  it("reaches a DetailTab.render context", async () => {
    const list = listing();
    const ctx = buildDetailTabContext(admin(list), reqCtx, reqCtx.req, { id: "u1" });
    expect(await ctx.read("order", { where: { userId: "u1" } })).toHaveLength(1);
  });
});
