import type { RequestContext, ResolvedAdminConfig, WidgetConfig } from "@flowpanel/core";
import {
  bars,
  checklist,
  custom,
  funnel,
  heatmap,
  kv,
  list,
  metric,
  stat,
  statGroup,
  table,
} from "@flowpanel/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";

const config = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
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

const now = new Date("2026-09-21T12:00:00Z");
const month = { from: new Date("2026-08-22T12:00:00Z"), to: now, preset: "last30d" as const };
const onMonth = () => buildWidgetContext(config, reqCtx, reqCtx.req, month);

function captionOf(tree: ReactNode): unknown {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map(captionOf).find((found) => found !== undefined);
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.props.caption ?? captionOf(el.props.children);
}

function Sample() {
  return null;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("widget captions", () => {
  it("puts the caption on every card kind", async () => {
    const coverage = "consented users only";
    const widgets: WidgetConfig[] = [
      metric("Visits", async () => 3, { coverage }),
      stat("Visits", 3, { coverage }),
      statGroup({ stats: [{ label: "Visits", value: 3 }], coverage }),
      kv({ items: [{ label: "Plan", value: "Pro" }], coverage }),
      bars({ query: async () => [], coverage }),
      funnel({ query: async () => [], coverage }),
      list({ query: async () => [], coverage }),
      table({ query: async () => [], coverage }),
      custom(Sample, {}, { coverage }),
      {
        kind: "barChart",
        label: "Visits",
        query: async () => [],
        options: { x: "date", y: "value", coverage },
      },
    ];
    for (const widget of widgets) {
      const tree = await renderWidget(widget, onMonth(), config, reqCtx);
      expect(captionOf(tree), widget.kind).toEqual({ text: coverage });
    }
  });

  it("captions a heatmap card", async () => {
    const widget = heatmap({ label: "Activity", query: async () => [], coverage: "sample" });
    expect(captionOf(await renderWidget(widget, onMonth(), config, reqCtx))).toEqual({
      text: "sample",
    });
  });

  it("captions a checklist card", async () => {
    const widget = checklist({ label: "Onboarding", items: [], coverage: "sample" });
    expect(captionOf(await renderWidget(widget, onMonth(), config, reqCtx))).toEqual({
      text: "sample",
    });
  });

  it("names where a capped range was cut before any other caption", async () => {
    const widget = stat("Orders", 1, { maxRange: "7d", coverage: "sample" });
    expect(captionOf(await renderWidget(widget, onMonth(), config, reqCtx))).toEqual({
      text: "Since 2026-09-14; older data is not kept",
      title: "2026-09-14 12:00",
    });
  });

  it("dates the cut in the admin's zone", async () => {
    const late = new Date("2026-09-21T22:00:00Z");
    vi.setSystemTime(late);
    const moscow = {
      ...config,
      formatting: { timeZone: "Europe/Moscow" },
    } as unknown as ResolvedAdminConfig;
    const ctx = buildWidgetContext(moscow, reqCtx, reqCtx.req, {
      from: new Date("2026-08-22T22:00:00Z"),
      to: late,
      preset: "last30d",
    });
    expect(
      captionOf(await renderWidget(stat("Orders", 1, { maxRange: "7d" }), ctx, moscow, reqCtx)),
    ).toEqual({
      text: "Since 2026-09-15; older data is not kept",
      title: "2026-09-15 01:00",
    });
  });

  it("dates the data, and warns once it is older than warnAfter", async () => {
    const at = async () => new Date("2026-09-21T06:00:00Z");
    const stale = stat("Runs", 1, { freshness: { at, warnAfter: "2h" }, coverage: "sample" });
    expect(captionOf(await renderWidget(stale, onMonth(), config, reqCtx))).toEqual({
      text: "Data as of 2026-09-21 06:00",
      title: "6 hours ago",
      tone: "warn",
    });
    const fresh = stat("Runs", 1, { freshness: { at, warnAfter: "12h" } });
    expect(captionOf(await renderWidget(fresh, onMonth(), config, reqCtx))).toEqual({
      text: "Data as of 2026-09-21 06:00",
      title: "6 hours ago",
    });
  });

  it("falls back to coverage when freshness is unknown or fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const unknown = stat("Runs", 1, { freshness: { at: async () => null }, coverage: "sample" });
    expect(captionOf(await renderWidget(unknown, onMonth(), config, reqCtx))).toEqual({
      text: "sample",
    });
    const broken = stat("Runs", 1, {
      freshness: { at: async () => Promise.reject(new Error("no rollup table")) },
      coverage: "sample",
    });
    expect(captionOf(await renderWidget(broken, onMonth(), config, reqCtx))).toEqual({
      text: "sample",
    });
    expect(error).toHaveBeenCalledTimes(1);
  });
});
