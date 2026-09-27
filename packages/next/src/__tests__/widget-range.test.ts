import type {
  RangeLimit,
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { list, metric, stat } from "@flowpanel/core";
import { ExpiredCard, MetricCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeWidget } from "../drawer/serialize-widget";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";
import { retainedRange } from "../runtime/widget-range";

const maxRangeContext = (widget: WidgetConfig, ctx: WidgetContext) =>
  retainedRange(widget, ctx).ctx;

const config = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {} },
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

const month = {
  from: new Date("2026-08-22T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last30d" as const,
};
const week = { from: new Date("2026-09-14T00:00:00Z"), to: month.to, preset: "last7d" as const };
const capped = (maxRange?: RangeLimit): WidgetConfig =>
  stat("Orders", 1, maxRange ? { maxRange } : {});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(month.to);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function deltaOf(tree: ReactNode): unknown {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map(deltaOf).find((found) => found !== undefined);
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.type === MetricCard ? el.props.delta : deltaOf(el.props.children);
}

describe("maxRangeContext", () => {
  it("cuts a longer range to its last N days, with nothing to compare past the cap", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, month);
    const cut = maxRangeContext(capped("7d"), ctx);
    expect(cut.dateRange.from.toISOString()).toBe("2026-09-14T00:00:00.000Z");
    expect(cut.dateRange.to).toEqual(month.to);
    expect(cut.dateRange.preset).toBe("custom");
    expect(cut.dateRange.previous).toBeNull();
  });

  it("keeps a range inside the cap, and its comparison while the cap still holds it", () => {
    const monthCtx = buildWidgetContext(config, reqCtx, reqCtx.req, month);
    const kept = maxRangeContext(capped("30d"), monthCtx);
    expect(kept.dateRange.from).toEqual(month.from);
    expect(kept.dateRange.previous).toBeNull();
    const weekCtx = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(maxRangeContext(capped("30d"), weekCtx).dateRange.previous).toEqual({
      from: new Date("2026-09-07T00:00:00Z"),
      to: week.from,
    });
    expect(maxRangeContext(capped(), monthCtx)).toBe(monthCtx);
  });

  it("gives a detail tab's whole history a window of N days and nothing to compare", () => {
    const detail = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), {
      id: "u1",
    });
    const cut = maxRangeContext(capped("30d"), detail);
    expect(cut.dateRange.to.getTime() - cut.dateRange.from.getTime()).toBe(30 * 86_400_000);
    expect(cut.dateRange.previous).toBeNull();
    expect(cut.row).toEqual({ id: "u1" });
  });

  it("hands two widgets with the same cap one context, however long the page takes", () => {
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, month);
    const first = maxRangeContext(capped("30d"), ctx);
    vi.setSystemTime(month.to.getTime() + 250);
    expect(maxRangeContext(capped("30d"), ctx)).toBe(first);
  });

  it("warns once in development about a limit that is not whole days", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, month);
    expect(maxRangeContext(capped("1.5d"), ctx)).toBe(ctx);
    expect(maxRangeContext(capped("1.5d"), ctx)).toBe(ctx);
    expect(maxRangeContext(capped("0d"), ctx)).toBe(ctx);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('maxRange "1.5d"');
  });
});

describe("a past range under a cap", () => {
  const onRange = (from: string, to: string) =>
    buildWidgetContext(config, reqCtx, reqCtx.req, {
      from: new Date(from),
      to: new Date(to),
      preset: "custom",
    });

  it("cuts at the retention horizon, not at its own end", () => {
    const cut = maxRangeContext(
      capped("30d"),
      onRange("2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"),
    );
    expect(cut.dateRange.from).toEqual(new Date("2026-08-22T00:00:00Z"));
    expect(cut.dateRange.to).toEqual(new Date("2026-09-01T00:00:00Z"));
    expect(cut.dateRange.previous).toBeNull();
  });

  it("is expired once it ends at or before the horizon", () => {
    expect(
      retainedRange(capped("30d"), onRange("2026-07-01T00:00:00Z", "2026-08-10T00:00:00Z")),
    ).toMatchObject({ expired: true, days: 30 });
    expect(
      retainedRange(capped("30d"), onRange("2026-07-01T00:00:00Z", "2026-08-22T00:00:00Z")),
    ).toMatchObject({ expired: true, days: 30 });
    expect(
      retainedRange(capped("30d"), buildWidgetContext(config, reqCtx, reqCtx.req, week)),
    ).toMatchObject({ expired: false });
  });

  it("runs no query when expired and says why, on a dashboard and in a drawer", async () => {
    const past = onRange("2026-07-01T00:00:00Z", "2026-08-10T00:00:00Z");
    const count = vi.fn(async () => 5);
    const orders = stat("Orders", count, { maxRange: "30d" });
    const tree = (await renderWidget(orders, past, config, reqCtx)) as ReactElement<
      Record<string, unknown>
    >;
    expect(tree.type).toBe(ExpiredCard);
    expect(tree.props).toEqual({ label: "Orders", caption: { text: "No data: kept for 30 days" } });
    expect(await serializeWidget(orders, config, reqCtx, past)).toEqual({
      kind: "list",
      label: "Orders",
      rows: [],
      emptyState: "No data: kept for 30 days",
    });
    const rows = vi.fn(async () => []);
    const scores = list({ label: "Scores", query: rows, maxRange: "30d", emptyState: "Gone" });
    const scoresTree = (await renderWidget(scores, past, config, reqCtx)) as ReactElement<
      Record<string, unknown>
    >;
    expect(scoresTree.props).toEqual({
      label: "Scores",
      caption: { text: "No data: kept for 30 days" },
    });
    expect(count).not.toHaveBeenCalled();
    expect(rows).not.toHaveBeenCalled();
  });
});

describe("where a capped range was cut", () => {
  const onRange = (from: string, to: string) =>
    buildWidgetContext(config, reqCtx, reqCtx.req, {
      from: new Date(from),
      to: new Date(to),
      preset: "custom",
    });

  it("reports the retention horizon a past range was cut at", () => {
    const kept = retainedRange(
      capped("30d"),
      onRange("2026-08-01T00:00:00Z", "2026-09-01T00:00:00Z"),
    );
    expect(kept.expired).toBe(false);
    if (kept.expired) return;
    expect(kept.keptSince).toEqual(new Date("2026-08-22T00:00:00Z"));
    expect(kept.ctx.dateRange.from).toEqual(new Date("2026-08-22T00:00:00Z"));
  });

  it("reports nothing when the range fits, or when there is no cap", () => {
    const onWeek = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(retainedRange(capped("30d"), onWeek)).toMatchObject({ expired: false, keptSince: null });
    expect(retainedRange(capped(), onWeek)).toEqual({
      expired: false,
      ctx: onWeek,
      keptSince: null,
    });
  });
});

describe("widgets with maxRange", () => {
  it("query the capped range on a dashboard", async () => {
    const seen: string[] = [];
    const widget = stat(
      "Orders",
      async (c) => {
        seen.push(c.dateRange.from.toISOString());
        return 1;
      },
      { maxRange: "7d" },
    );
    await renderWidget(
      widget,
      buildWidgetContext(config, reqCtx, reqCtx.req, month),
      config,
      reqCtx,
    );
    expect(seen).toEqual(["2026-09-14T00:00:00.000Z"]);
  });

  it("query the capped range in a drawer", async () => {
    const widget = stat("First day", async (c) => c.dateRange.from.toISOString(), {
      maxRange: "7d",
    });
    const card = await serializeWidget(
      widget,
      config,
      reqCtx,
      buildWidgetContext(config, reqCtx, reqCtx.req, month),
    );
    expect(card).toMatchObject({ kind: "stat", value: "2026-09-14T00:00:00.000Z" });
  });

  it("never compare against days the cap has already deleted", async () => {
    const orders = metric("Orders", async () => 5, { compare: true, maxRange: "30d" });
    const onMonth = buildWidgetContext(config, reqCtx, reqCtx.req, month);
    expect(deltaOf(await renderWidget(orders, onMonth, config, reqCtx))).toBeNull();
    const onWeek = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(deltaOf(await renderWidget(orders, onWeek, config, reqCtx))).toMatchObject({
      previous: 5,
    });
  });

  it("never compare a week back past the cap", async () => {
    const orders = metric("Orders", async () => 5, {
      compare: { against: "weekAgo" },
      maxRange: "7d",
    });
    const onWeek = buildWidgetContext(config, reqCtx, reqCtx.req, week);
    expect(deltaOf(await renderWidget(orders, onWeek, config, reqCtx))).toBeNull();
  });
});
