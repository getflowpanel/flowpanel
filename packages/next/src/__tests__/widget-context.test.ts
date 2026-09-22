import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDetailTabContext,
  buildWidgetContext,
  detailTabDateRange,
} from "../runtime/widget-context";

const config = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: { tag: "db" } },
  labels: { widget: { empty: "Nothing here" } },
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const dateRange = { from: new Date(0), to: new Date(1), preset: "custom" as const };

function ctx(row?: Record<string, unknown>) {
  return buildWidgetContext(config, reqCtx, reqCtx.req, dateRange, row);
}

describe("buildWidgetContext — href", () => {
  it("builds a mount-aware list and record path", () => {
    expect(ctx().href("users")).toBe("/admin/users");
    expect(ctx().href("users", "u 1")).toBe("/admin/users/u%201");
  });

  it("appends a filter as the list page's own query key", () => {
    expect(ctx().href("orders", undefined, { filter: { status: "paid" } })).toBe(
      "/admin/orders?f_status=paid",
    );
  });

  it("appends a tab, and drops a filter value that is not there", () => {
    expect(ctx().href("users", 7, { tab: "activity", filter: { role: undefined } })).toBe(
      "/admin/users/7?tab=activity",
    );
  });
});

describe("buildWidgetContext — query", () => {
  it("runs one query for two widgets asking under the same key", async () => {
    const shared = ctx();
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    const [a, b] = await Promise.all([shared.query("mrr", run), shared.query("mrr", run)]);
    expect(calls).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it("keeps different keys independent", async () => {
    const shared = ctx();
    await shared.query("a", async () => 1);
    await shared.query("b", async () => 2);
    expect(await shared.query("b", async () => 99)).toBe(2);
  });

  it("does not share a memo between two requests", async () => {
    expect(await ctx().query("k", async () => "first")).toBe("first");
    expect(await ctx().query("k", async () => "second")).toBe("second");
  });

  it("memoises a failure too, so the request does not retry under that key", async () => {
    const shared = ctx();
    let calls = 0;
    const run = () => {
      calls += 1;
      return Promise.reject(new Error("db down"));
    };
    await expect(shared.query("mrr", run)).rejects.toThrow("db down");
    await expect(shared.query("mrr", run)).rejects.toThrow("db down");
    expect(calls).toBe(1);
  });
});

describe("buildWidgetContext — labels, db and row", () => {
  it("resolves the admin's labels over the defaults", () => {
    expect(ctx().labels.widget.empty).toBe("Nothing here");
    expect(ctx().labels.widget.seeAll).toBe("See all");
  });

  it("hands over the adapter's own db and the request's session", () => {
    expect(ctx().db).toEqual({ tag: "db" });
    expect(ctx().session).toBeNull();
  });

  it("carries a row only when one is given", () => {
    expect(ctx().row).toBeUndefined();
    expect(ctx({ id: "1" }).row).toEqual({ id: "1" });
  });
});

describe("detailTabDateRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the clock on every call rather than at module load", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T10:00:00.000Z"));
    const first = detailTabDateRange();
    vi.advanceTimersByTime(5);
    const second = detailTabDateRange();
    expect(first.to.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    expect(second.to.toISOString()).toBe("2026-09-20T10:00:00.005Z");
    expect(second.to).not.toBe(first.to);
  });

  it("spans the record's whole lifetime and hands out no shared object", () => {
    const range = detailTabDateRange();
    expect(range.from.getTime()).toBe(0);
    expect(range.preset).toBe("custom");
    range.to.setFullYear(1999);
    expect(detailTabDateRange().to.getFullYear()).toBeGreaterThan(1999);
  });

  it("gives each detail-tab context its own range", () => {
    const a = buildDetailTabContext(config, reqCtx, reqCtx.req, { id: "1" });
    const b = buildDetailTabContext(config, reqCtx, reqCtx.req, { id: "1" });
    expect(a.dateRange).not.toBe(b.dateRange);
    expect(a.dateRange.to).not.toBe(b.dateRange.to);
  });
});
