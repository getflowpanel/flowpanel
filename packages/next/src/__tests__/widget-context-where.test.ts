import type { Adapter, ColumnMeta, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWidgetContext,
  comparisonRange,
  detailTabDateRange,
  rangedContext,
} from "../runtime/widget-context";

const COLUMNS = ["id", "userId", "status", "total", "createdAt"];

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

function admin(count: NonNullable<Adapter["count"]>, list?: Adapter["list"]) {
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: (ref) => ({
      name: (ref as { __name: string }).__name,
      columns: COLUMNS.map(meta),
      primaryKey: "id",
    }),
    inferSchema: () => ({}) as never,
    list: list ?? (async () => ({ rows: [], total: 0, page: 1, pageSize: 100 })),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
    count,
  };
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource({ __name: "order" }, { columns: ["id", "userId", "status"] })],
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ctx.count with a typed where", () => {
  it("hands the adapter its own range and set shapes", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    expect(await ctx.count("order", { total: { gte: 10 }, status: ["paid", "refunded"] })).toBe(3);
    expect(count).toHaveBeenCalledWith(
      { __name: "order" },
      { total: { op: "range", gte: 10 }, status: { op: "in", values: ["paid", "refunded"] } },
    );
  });

  it("counts the picked period of a timestamp field with range", async () => {
    const count = vi.fn().mockResolvedValue(4);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    await ctx.count("order", { status: "paid" }, { range: "createdAt" });
    expect(count).toHaveBeenCalledWith(
      { __name: "order" },
      { status: "paid", createdAt: { op: "range", gte: week.from, lte: week.to } },
    );
  });

  it("counts the whole history on a record page, where there is no picked period", async () => {
    const count = vi.fn().mockResolvedValue(9);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, detailTabDateRange());
    await ctx.count("order", { userId: "u1" }, { range: "createdAt" });
    expect(count).toHaveBeenCalledWith({ __name: "order" }, { userId: "u1" });
    await expect(ctx.count("order", {}, { range: "creatdAt" })).rejects.toThrow(
      /ranges "creatdAt"/,
    );
  });

  it("counts the compared period again instead of reusing this period's memo", async () => {
    const count = vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    const before = comparisonRange(ctx);
    if (!before) throw new Error("fixture: a week has a previous period");
    const earlier = rangedContext(ctx, { ...before, preset: "custom" });
    expect(await ctx.count("order", {}, { range: "createdAt" })).toBe(4);
    expect(await earlier.count("order", {}, { range: "createdAt" })).toBe(2);
    expect(count).toHaveBeenLastCalledWith(
      { __name: "order" },
      { createdAt: { op: "range", gte: before.from, lte: before.to } },
    );
  });

  it("throws on a range field that is not a column", async () => {
    const ctx = buildWidgetContext(admin(vi.fn()), reqCtx, reqCtx.req, week);
    await expect(ctx.count("order", {}, { range: "creatdAt" })).rejects.toThrow(
      /ranges "creatdAt".*Did you mean "createdAt"\?/s,
    );
  });

  it("counts 0 for a null or empty value and warns once per field, as it does for undefined", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const count = vi.fn().mockResolvedValue(99);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    expect(await ctx.count("order", { userId: null })).toBe(0);
    expect(await ctx.count("order", { userId: null, status: "paid" })).toBe(0);
    expect(await ctx.count("order", { status: "" })).toBe(0);
    expect(count).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /ctx\.count\("order"\) filters "userId" by null and counts 0/,
    );
    expect(String(warn.mock.calls[1]?.[0])).toMatch(/filters "status" by "" and counts 0/);
  });

  it("throws on a misspelt field even when its value is missing", async () => {
    const count = vi.fn().mockResolvedValue(99);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    await expect(ctx.count("order", { usrId: undefined })).rejects.toThrow(
      /filters by "usrId".*Did you mean "userId"\?/s,
    );
    expect(count).not.toHaveBeenCalled();
  });

  it("counts 0 for an empty set without a query", async () => {
    const count = vi.fn().mockResolvedValue(99);
    const ctx = buildWidgetContext(admin(count), reqCtx, reqCtx.req, week);
    expect(await ctx.count("order", { status: [] })).toBe(0);
    expect(count).not.toHaveBeenCalled();
  });
});

describe("ctx.read with range", () => {
  it("reads the picked period of a timestamp field", async () => {
    const list = vi.fn<Adapter["list"]>(async () => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 100,
    }));
    const ctx = buildWidgetContext(admin(vi.fn(), list), reqCtx, reqCtx.req, week);
    await ctx.read("order", { where: { status: "paid" }, range: "createdAt" });
    expect(list.mock.calls[0]?.[1].filters).toEqual({
      status: "paid",
      createdAt: { op: "range", gte: week.from, lte: week.to },
    });
  });
});
