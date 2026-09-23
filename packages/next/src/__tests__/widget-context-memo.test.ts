import type { Adapter, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { buildDetailTabContext, buildWidgetContext } from "../runtime/widget-context";

function admin(count?: Adapter["count"]) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: (ref) => ({
      name: (ref as { __name: string }).__name,
      columns: [],
      primaryKey: "id",
    }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 1 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
    ...(count ? { count } : {}),
  };
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource({ __name: "orders" }, { columns: ["id"] }),
      resource({ __name: "users" }, { columns: ["id"], rowKey: "uid" }),
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

describe("ctx.count memo", () => {
  it("counts one resource and where once per request, whatever the key order", async () => {
    const count = vi.fn().mockResolvedValue(4);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    const [a, b] = await Promise.all([
      ctx.count("orders", { status: "paid", userId: "u1" }),
      ctx.count("orders", { userId: "u1", status: "paid" }),
    ]);
    expect([a, b]).toEqual([4, 4]);
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("counts a different where again, and does not share across requests", async () => {
    const count = vi.fn().mockResolvedValue(2);
    const config = admin(count);
    const first = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    await first.count("orders", { status: "paid" });
    await first.count("orders", { status: "failed" });
    await buildWidgetContext(config, reqCtx, reqCtx.req, week).count("orders", { status: "paid" });
    expect(count).toHaveBeenCalledTimes(3);
  });
});

describe("keyless ctx.query", () => {
  it("runs one function once per argument list", async () => {
    const ctx = buildWidgetContext(admin(), reqCtx, reqCtx.req, week);
    const load = vi.fn(async (userId: string, limit: number) => `${userId}:${limit}`);
    const results = await Promise.all([
      ctx.query(load, "u1", 10),
      ctx.query(load, "u1", 10),
      ctx.query(load, "u2", 10),
    ]);
    expect(results).toEqual(["u1:10", "u1:10", "u2:10"]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("compares dates by value and objects by identity", async () => {
    const ctx = buildWidgetContext(admin(), reqCtx, reqCtx.req, week);
    const load = vi.fn(async (_input: Date | object) => 1);
    await ctx.query(load, new Date(5));
    await ctx.query(load, new Date(5));
    await ctx.query(load, {});
    await ctx.query(load, {});
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("keeps a keyed call and a keyless call apart", async () => {
    const ctx = buildWidgetContext(admin(), reqCtx, reqCtx.req, week);
    expect(await ctx.query("k", async () => "keyed")).toBe("keyed");
    expect(await ctx.query(async () => "keyless")).toBe("keyless");
  });
});

describe("ctx.id", () => {
  it("reads the record's key through the resource's rowKey", () => {
    const ctx = buildWidgetContext(admin(), reqCtx, reqCtx.req, week, { uid: 42, id: "x" }, "uid");
    expect(ctx.id).toBe("42");
  });

  it("defaults the key to id, and is absent on a dashboard or for a non-scalar key", () => {
    const config = admin();
    expect(buildWidgetContext(config, reqCtx, reqCtx.req, week, { id: "u1" }).id).toBe("u1");
    expect(buildWidgetContext(config, reqCtx, reqCtx.req, week).id).toBeUndefined();
    expect(
      buildWidgetContext(config, reqCtx, reqCtx.req, week, { id: { n: 1 } }).id,
    ).toBeUndefined();
  });

  it("reaches a DetailTab.render context", () => {
    expect(buildDetailTabContext(admin(), reqCtx, reqCtx.req, { uid: "7" }, "uid").id).toBe("7");
  });
});
