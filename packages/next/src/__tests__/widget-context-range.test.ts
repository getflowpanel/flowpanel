import type { RequestContext, ResolvedAdminConfig, WidgetContext } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { buildWidgetContext, detailTabDateRange, rangedContext } from "../runtime/widget-context";
import { fakeWidgetContext } from "./widget-context-fixture";

const config = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  adapter: { kind: "drizzle", db: {} },
  formatting: { timeZone: "Europe/Moscow" },
  labels: {},
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  pagesByPath: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

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

describe("ctx.dateRange", () => {
  it("carries the period before it and the admin's zone", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(ctx.dateRange.previous).toEqual({
      from: new Date("2026-09-07T00:00:00Z"),
      to: new Date("2026-09-14T00:00:00Z"),
    });
    expect(ctx.dateRange.timeZone).toBe("Europe/Moscow");
    expect(ctx.dateRange.preset).toBe("last7d");
  });

  it("compares today with yesterday up to the same clock time in the admin's zone", () => {
    const today = {
      from: new Date("2026-09-22T21:00:00Z"),
      to: new Date("2026-09-23T07:00:00Z"),
      preset: "today" as const,
    };
    expect(buildWidgetContext(config, reqCtx, reqCtx.req, today).dateRange.previous).toEqual({
      from: new Date("2026-09-21T21:00:00Z"),
      to: new Date("2026-09-22T07:00:00Z"),
    });
  });

  it("has no previous period over a detail tab's whole history", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), { id: "u1" });
    expect(ctx.dateRange.previous).toBeNull();
  });
});

describe("rangedContext", () => {
  const firstDay = (c: WidgetContext) =>
    c.query("first-day", async () => c.dateRange.from.toISOString());

  it("runs a keyed query again for the previous period", async () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const previous = ctx.dateRange.previous;
    if (previous === null) throw new Error("a week has a previous period");
    const before = rangedContext(ctx, { ...previous, preset: "custom" });
    expect(await firstDay(ctx)).toBe("2026-09-14T00:00:00.000Z");
    expect(await firstDay(before)).toBe("2026-09-07T00:00:00.000Z");
  });

  it("hands two widgets one context per range, so they share its memo", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    const range = {
      from: new Date("2026-09-01T00:00:00Z"),
      to: week.to,
      preset: "custom" as const,
    };
    expect(rangedContext(ctx, range)).toBe(rangedContext(ctx, range));
    expect(rangedContext(ctx, week)).toBe(ctx);
  });

  it("keeps the record and its key", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), { id: "u1" });
    const recent = rangedContext(ctx, week);
    expect(recent.row).toEqual({ id: "u1" });
    expect(recent.id).toBe("u1");
    expect(recent.dateRange.previous?.to).toEqual(week.from);
  });

  it("widens a hand-built context too", () => {
    const shifted = rangedContext(fakeWidgetContext(), week);
    expect(shifted.dateRange.previous?.to).toEqual(week.from);
    expect(shifted.dateRange.timeZone).toBe("UTC");
  });
});

describe("ctx.format", () => {
  it("follows the admin's formatting", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(ctx.format.dateTime(new Date("2026-09-23T21:30:00Z"))).toBe("2026-09-24 00:30");
  });
});
