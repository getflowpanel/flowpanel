import type {
  DashboardConfig,
  RequestContext,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import {
  banner,
  bars,
  checklist,
  enumOf,
  heatmap,
  kv,
  metric,
  OTHER_KEY,
  table,
  timeline,
  tracker,
} from "@flowpanel/core";
import { DashboardFilters } from "@flowpanel/next/client";
import {
  BarsCard,
  ChecklistCard,
  HeatmapCard,
  ListCard,
  TableWidget,
  TimelineCard,
  TrackerCard,
} from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";
import {
  activeFilters,
  clearFiltersHref,
  filterChoices,
  filterHref,
} from "../runtime/dashboard-filters";
import { renderWidget } from "../runtime/render-widget";
import { resolveLink } from "../runtime/resolve-link";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";

const parsing: DashboardConfig = {
  path: "/parsing",
  label: "Parsing",
  filters: [
    { key: "platform", label: "Marketplace", options: enumOf({ kwork: "Kwork", fl: "FL.ru" }) },
    { key: "kind", label: "Kind", options: async () => [{ label: "Ban", value: "ban" }] },
  ],
  sections: [],
};

const config = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {} },
  labels: {},
  resourcesByName: new Map(),
  dashboardsByPath: new Map([["/parsing", parsing]]),
  pagesByPath: new Map(),
  __resolved: true,
} as unknown as ResolvedAdminConfig;

const url = "http://localhost/admin/parsing?preset=last7d&f_platform=kwork";
const reqCtx: RequestContext = {
  req: new Request(url),
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
const filtered = (filters: Record<string, string> = { platform: "kwork" }): WidgetContext =>
  buildWidgetContext(config, reqCtx, reqCtx.req, week, undefined, undefined, undefined, filters);

function propsOf(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map((child) => propsOf(child, target)).find(Boolean);
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.type === target ? el.props : propsOf(el.props.children, target);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (!isValidElement(node)) return "";
  return textOf((node.props as { children?: unknown }).children);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(week.to);
});

afterEach(() => vi.useRealTimers());

describe("dashboard filters", () => {
  it("reads only declared, non-empty f_ keys from the URL", () => {
    const params = new URLSearchParams("f_platform=kwork&f_kind=&f_other=x&preset=today");
    expect(activeFilters(parsing, params)).toEqual({ platform: "kwork" });
  });

  it("resolves each filter's options and its value", async () => {
    expect(await filterChoices(parsing, filtered())).toEqual([
      {
        key: "platform",
        label: "Marketplace",
        value: "kwork",
        options: [
          { label: "Kwork", value: "kwork" },
          { label: "FL.ru", value: "fl" },
        ],
      },
      { key: "kind", label: "Kind", value: null, options: [{ label: "Ban", value: "ban" }] },
    ]);
  });

  it("links a filter value and clears every filter, keeping the range", () => {
    const ctx = filtered();
    expect(filterHref(ctx, "platform", "fl")).toBe("/admin/parsing?preset=last7d&f_platform=fl");
    expect(clearFiltersHref(ctx)).toBe("/admin/parsing?preset=last7d");
  });

  it("links the landing dashboard without a trailing slash, like the nav", () => {
    const root = { ...reqCtx, req: new Request("http://localhost/admin/?preset=today") };
    const ctx = buildWidgetContext(config, root, root.req, week);
    expect(filterHref(ctx, "platform", "fl")).toBe("/admin?preset=today&f_platform=fl");
  });

  it("shows only All when a filter's options fail, and logs why", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const flaky = {
      ...parsing,
      filters: [
        {
          key: "kind",
          label: "Kind",
          options: async () => {
            throw new Error("db down");
          },
        },
      ],
    };
    expect(await filterChoices(flaky, filtered({}))).toEqual([
      { key: "kind", label: "Kind", value: null, options: [] },
    ]);
    expect(String(error.mock.calls[0]?.[0])).toContain("dashboard filter options failed");
    error.mockRestore();
  });

  it("shows a filter value the options do not list", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const flaky = {
      ...parsing,
      filters: [
        {
          key: "kind",
          label: "Kind",
          options: async () => {
            throw new Error("db down");
          },
        },
      ],
    };
    expect(await filterChoices(flaky, filtered({ kind: "ban" }))).toEqual([
      { key: "kind", label: "Kind", value: "ban", options: [{ label: "ban", value: "ban" }] },
    ]);
    expect(await filterChoices(parsing, filtered({ platform: "avito" }))).toContainEqual(
      expect.objectContaining({
        key: "platform",
        options: [
          { label: "Kwork", value: "kwork" },
          { label: "FL.ru", value: "fl" },
          { label: "avito", value: "avito" },
        ],
      }),
    );
    error.mockRestore();
  });

  it("is empty on a record page, and kept by the compared period", async () => {
    const detail = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), {
      id: "u1",
    });
    expect(detail.filters).toEqual({});
    const seen: string[] = [];
    const widget = metric(
      "Orders",
      async (c) => {
        seen.push(c.filters.platform ?? "none");
        return 1;
      },
      { compare: true },
    );
    await renderWidget(widget, filtered(), config, reqCtx);
    expect(seen).toEqual(["kwork", "kwork"]);
  });

  it("carries explicit filters on a dashboard link, and names one the target lacks", () => {
    expect(
      resolveLink(config, filtered(), { dashboard: "/parsing", filter: { platform: "fl" } }),
    ).toBe("/admin/parsing?preset=last7d&f_platform=fl");
    expect(() =>
      resolveLink(config, filtered(), { dashboard: "/parsing", filter: { platfrom: "fl" } }),
    ).toThrow(/sets the filter "platfrom".*Did you mean "platform"\?/s);
  });

  it("puts the filters beside the date picker with their current values", async () => {
    const node = await DashboardPage({
      config,
      dashboard: parsing,
      searchParams: new URLSearchParams("preset=last7d&f_platform=kwork"),
      req: reqCtx.req,
      reqCtx,
    });
    const props = propsOf(node, DashboardFilters);
    expect(
      (props?.filters as Array<{ key: string; value: string | null }>).map((f) => [f.key, f.value]),
    ).toEqual([
      ["platform", "kwork"],
      ["kind", null],
    ]);
  });
});

describe("click to filter", () => {
  it("links each bar, tracker row and table row to the dashboard filtered by it", async () => {
    const ctx = filtered({});
    const barRows = propsOf(
      await renderWidget(
        bars({
          filterOnClick: "platform",
          query: async () => [
            { key: "fl", label: "FL.ru", value: 3 },
            { label: "Kwork", value: 2 },
            { key: OTHER_KEY, label: "Other", value: 1 },
          ],
        }),
        ctx,
        config,
        reqCtx,
      ),
      BarsCard,
    )?.rows as Array<{ href?: string }>;
    expect(barRows.map((row) => row.href)).toEqual([
      "/admin/parsing?preset=last7d&f_platform=fl",
      undefined,
      undefined,
    ]);
    const trackerRows = propsOf(
      await renderWidget(
        tracker({
          filterOnClick: "platform",
          rows: async () => [{ key: "fl", label: "FL.ru", cells: [] }],
        }),
        ctx,
        config,
        reqCtx,
      ),
      TrackerCard,
    )?.rows as Array<{ href?: string }>;
    expect(trackerRows[0]?.href).toBe("/admin/parsing?preset=last7d&f_platform=fl");
    const tableProps = propsOf(
      await renderWidget(
        table({
          filterOnClick: "platform",
          rowKey: "platform",
          query: async () => [{ platform: "fl" }],
        }),
        ctx,
        config,
        reqCtx,
      ),
      TableWidget,
    );
    expect(tableProps?.hrefs).toEqual(["/admin/parsing?preset=last7d&f_platform=fl"]);
  });

  it("says an empty card is empty because of the filters, with a way out", async () => {
    const barsProps = propsOf(
      await renderWidget(bars({ query: async () => [] }), filtered(), config, reqCtx),
      BarsCard,
    );
    expect(textOf(barsProps?.emptyState)).toBe(
      "Nothing matches the current filters. Clear filters",
    );
    const tableProps = propsOf(
      await renderWidget(table({ query: async () => [] }), filtered(), config, reqCtx),
      TableWidget,
    );
    expect(textOf(tableProps?.emptyState)).toContain("Clear filters");
    const plain = propsOf(
      await renderWidget(bars({ query: async () => [] }), filtered({}), config, reqCtx),
      BarsCard,
    );
    expect(plain?.emptyState).toBe("No data yet");
    const quiet = propsOf(
      await renderWidget(banner({ query: async () => [] }), filtered(), config, reqCtx),
      ListCard,
    );
    expect(quiet?.allClear).toBe("Nothing matches the current filters.");
    const trackerProps = propsOf(
      await renderWidget(
        tracker({
          rows: async (c) =>
            c.filters.platform === "kwork" ? [] : [{ key: "x", label: "X", cells: [] }],
        }),
        filtered(),
        config,
        reqCtx,
      ),
      TrackerCard,
    );
    expect(textOf(trackerProps?.emptyState)).toBe(
      "Nothing matches the current filters. Clear filters",
    );
  });

  it("says so on an empty timeline, checklist and heatmap too", async () => {
    const cards = [
      [timeline({ kinds: {}, query: async () => [] }), TimelineCard],
      [checklist({ items: [] }), ChecklistCard],
      [heatmap({ query: async () => [] }), HeatmapCard],
    ] as const;
    for (const [widget, Card] of cards) {
      const props = propsOf(await renderWidget(widget, filtered(), config, reqCtx), Card);
      expect(textOf(props?.emptyState)).toBe("Nothing matches the current filters. Clear filters");
    }
  });

  it("warns once in development about keyless bars and a kv field without a record", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderWidget(
      bars({ filterOnClick: "kind", query: async () => [{ label: "Kwork", value: 3 }] }),
      filtered(),
      config,
      reqCtx,
    );
    await renderWidget(
      kv({ items: [{ label: "Plan", field: "plan" }] }),
      filtered(),
      config,
      reqCtx,
    );
    const said = warn.mock.calls.map((call) => String(call[0]));
    expect(said.some((line) => line.includes("some rows carry no key"))).toBe(true);
    expect(said.some((line) => line.includes("a dashboard has no record"))).toBe(true);
    warn.mockRestore();
  });
});
