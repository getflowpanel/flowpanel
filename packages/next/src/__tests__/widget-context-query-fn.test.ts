import type { Adapter, RequestContext, WidgetContext } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";

vi.mock("../runtime/widget-owner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../runtime/widget-owner")>()),
  noteMemoHit: vi.fn(),
}));

import { buildWidgetContext, rangedContext } from "../runtime/widget-context";
import { noteMemoHit } from "../runtime/widget-owner";
import { fakeWidgetContext } from "./widget-context-fixture";

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
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [resource({ __name: "runs" }, { columns: ["id"] })],
});

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

describe("ctx.query(fn)", () => {
  it("calls fn with the context, once per context, and counts the second call as a memo hit", async () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const hourly = vi.fn(async (c: WidgetContext) => c.dateRange.from.toISOString());
    expect(await ctx.query(hourly)).toBe("2026-09-14T00:00:00.000Z");
    expect(await ctx.query(hourly)).toBe("2026-09-14T00:00:00.000Z");
    expect(hourly).toHaveBeenCalledTimes(1);
    expect(hourly.mock.calls[0]?.[0]).toBe(ctx);
    expect(noteMemoHit).toHaveBeenCalledTimes(1);
  });

  it("runs again for a ranged context, with that context's range", async () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const before = rangedContext(ctx, {
      from: new Date("2026-09-07T00:00:00Z"),
      to: new Date("2026-09-14T00:00:00Z"),
      preset: "custom",
    });
    const from = async (c: WidgetContext) => c.dateRange.from.toISOString();
    expect(await before.query(from)).toBe("2026-09-07T00:00:00.000Z");
    expect(await ctx.query(from)).toBe("2026-09-14T00:00:00.000Z");
  });

  it("keeps a 0.3.0 thunk's default parameter", async () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(await ctx.query(async (limit: number = 5) => limit)).toBe(5);
    expect(await ctx.query(async (limit: number) => limit, 3)).toBe(3);
  });

  it("does the same in the shared render fixture", async () => {
    const ctx = fakeWidgetContext();
    expect(await ctx.query(async (c: WidgetContext) => c.dateRange.timeZone)).toBe("UTC");
    expect(await ctx.query(async (limit: number = 5) => limit)).toBe(5);
  });

  it("hands a context derived from the fixture itself, not the fixture", async () => {
    const other = rangedContext(fakeWidgetContext(), {
      from: new Date("2026-09-07T00:00:00Z"),
      to: new Date("2026-09-14T00:00:00Z"),
      preset: "custom",
    });
    expect(await other.query(async (c: WidgetContext) => c)).toBe(other);
  });

  it("hands the context to a function whose first parameter is optional", async () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const recent = async (days?: unknown) => days;
    expect(await ctx.query(recent)).toBe(ctx);
  });
});
