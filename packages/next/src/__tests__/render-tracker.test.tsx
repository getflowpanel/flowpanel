import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { tracker } from "@flowpanel/core";
import { TrackerCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";

const config = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {} },
  labels: {},
  formatting: { timeZone: "Europe/Moscow" },
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  pagesByPath: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin/parsing"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const now = new Date("2026-09-21T09:30:00Z");
const today = { from: new Date("2026-09-20T21:00:00Z"), to: now, preset: "today" as const };

function cardProps(tree: ReactNode): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map(cardProps).find((found) => found !== undefined);
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.type === TrackerCard ? el.props : cardProps(el.props.children);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe("tracker widget", () => {
  it("queries its own window, not the picked range, and titles every block", async () => {
    const seen: string[] = [];
    const widget = tracker({
      label: "Marketplaces · 24 h",
      query: async (c) => {
        seen.push(`${c.dateRange.from.toISOString()}|${c.dateRange.to.toISOString()}`);
        return [{ at: new Date("2026-09-21T08:10:00Z"), platform: "kwork", runs: 30, failed: 20 }];
      },
      at: "at",
      by: "platform",
      value: (rows) =>
        rows.reduce((s, r) => s + r.failed, 0) / rows.reduce((s, r) => s + r.runs, 0),
      volume: "runs",
      tones: { warn: 0.3, err: 0.5 },
      format: "percent",
      summary: async (row) => `last block ${row.cells.at(-2)?.tone}`,
      rowHref: (key) => `/runs?platform=${key}`,
    });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, today);
    const props = cardProps(await renderWidget(widget, ctx, config, reqCtx));
    expect(seen).toEqual(["2026-09-20T10:00:00.000Z|2026-09-21T09:30:00.000Z"]);
    const row = (props?.rows as Array<Record<string, unknown>>)[0];
    expect(row).toMatchObject({
      key: "kwork",
      label: "kwork",
      tone: "err",
      summary: "last block err",
      href: "/runs?platform=kwork",
    });
    expect((row?.cells as Array<{ title: string }>).at(-2)?.title).toBe(
      "2026-09-21 11:00 · 66.7% · 30 observed",
    );
  });

  it("formats a bytes value the same way core's formatNumber does", async () => {
    const widget = tracker({
      query: async () => [{ at: new Date("2026-09-21T08:10:00Z"), platform: "kwork", bytes: 2048 }],
      at: "at",
      by: "platform",
      value: (rows) => rows.reduce((s, r) => s + r.bytes, 0),
      format: "bytes",
    });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, today);
    const props = cardProps(await renderWidget(widget, ctx, config, reqCtx));
    const row = (props?.rows as Array<Record<string, unknown>>)[0];
    expect((row?.cells as Array<{ title: string }>).at(-2)?.title).toBe(
      "2026-09-21 11:00 · 2.0 KB · 1 observed",
    );
  });

  it("renders rows built by hand, toned by their last blocks", async () => {
    const widget = tracker({
      rows: async () => [
        { key: "sync", label: "Sync", cells: [{ tone: "ok" }, { tone: "warn", title: "slow" }] },
      ],
    });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, today);
    expect(cardProps(await renderWidget(widget, ctx, config, reqCtx))?.rows).toEqual([
      {
        key: "sync",
        label: "Sync",
        tone: "warn",
        cells: [
          { tone: "ok", title: "Sync 1/2" },
          { tone: "warn", title: "slow" },
        ],
      },
    ]);
  });

  it("shows the empty state when there is nothing to track", async () => {
    const widget = tracker({ query: async () => [], at: "at" as never, by: "platform" as never });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, today);
    expect(cardProps(await renderWidget(widget, ctx, config, reqCtx))).toMatchObject({
      rows: [],
      emptyState: "No data yet",
    });
  });

  it("carries its caption to the card", async () => {
    const widget = tracker({ rows: async () => [], coverage: "Kwork and FL.ru only" });
    const ctx = buildWidgetContext(config, reqCtx, reqCtx.req, today);
    expect(cardProps(await renderWidget(widget, ctx, config, reqCtx))?.caption).toEqual({
      text: "Kwork and FL.ru only",
    });
  });
});
