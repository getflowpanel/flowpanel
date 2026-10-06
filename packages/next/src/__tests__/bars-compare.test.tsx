import type { RequestContext, ResolvedAdminConfig, WidgetContext } from "@flowpanel/core";
import { bars } from "@flowpanel/core";
import { BarsCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { barRows, joinPrevious } from "../runtime/bar-rows";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";

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

const week = {
  from: new Date("2026-09-14T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last7d" as const,
};
const month = { from: new Date("2026-08-22T00:00:00Z"), to: week.to, preset: "last30d" as const };
const thisWeek = (c: WidgetContext) => c.dateRange.from.getTime() === week.from.getTime();
const onRange = (range: typeof week | typeof month) =>
  buildWidgetContext(config, reqCtx, reqCtx.req, range);

function cardRows(tree: ReactNode): unknown {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) return tree.map(cardRows).find((found) => found !== undefined);
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.type === BarsCard ? el.props.rows : cardRows(el.props.children);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(week.to);
});

afterEach(() => vi.useRealTimers());

describe("joinPrevious", () => {
  it("joins by key, else by label, and keeps a row's own previous", () => {
    expect(
      joinPrevious(
        [
          { key: "kwork", label: "Kwork", value: 12 },
          { label: "fl.ru", value: 3 },
          { label: "habr", value: 4, previous: 9 },
        ],
        [
          { key: "kwork", label: "kwork (old name)", value: 10 },
          { label: "fl.ru", value: 6 },
          { label: "habr", value: 1 },
        ],
      ),
    ).toEqual([
      { key: "kwork", label: "Kwork", value: 12, previous: 10 },
      { label: "fl.ru", value: 3, previous: 6 },
      { label: "habr", value: 4, previous: 9 },
    ]);
  });

  it("leaves a row the compared period did not return without a change", () => {
    expect(joinPrevious([{ label: "youdo", value: 2 }], [{ label: "kwork", value: 1 }])).toEqual([
      { label: "youdo", value: 2 },
    ]);
  });
});

describe("bars({ compare })", () => {
  it("runs the query again for the previous period and fills previous", async () => {
    const widget = bars({
      compare: true,
      query: async (c) =>
        thisWeek(c)
          ? [
              { key: "kwork", label: "Kwork", value: 12 },
              { label: "fl.ru", value: 3 },
            ]
          : [
              { key: "kwork", label: "Kwork", value: 10 },
              { label: "fl.ru", value: 6 },
            ],
    });
    expect(await barRows(widget, onRange(week))).toEqual([
      { key: "kwork", label: "Kwork", value: 12, previous: 10 },
      { label: "fl.ru", value: 3, previous: 6 },
    ]);
  });

  it("compares with the same range a week earlier", async () => {
    const seen: string[] = [];
    const widget = bars({
      compare: { against: "weekAgo" },
      query: async (c) => {
        seen.push(c.dateRange.from.toISOString());
        return [{ label: "kwork", value: thisWeek(c) ? 5 : 4 }];
      },
    });
    expect(await barRows(widget, onRange(week))).toEqual([
      { label: "kwork", value: 5, previous: 4 },
    ]);
    expect(seen).toContain("2026-09-07T00:00:00.000Z");
  });

  it("shows no change over a detail tab's whole history", async () => {
    const widget = bars({ compare: true, query: async () => [{ label: "kwork", value: 5 }] });
    const detail = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), {
      id: "u1",
    });
    expect(await barRows(widget, detail)).toEqual([{ label: "kwork", value: 5 }]);
  });

  it("shows no change when the compared period lies past maxRange", async () => {
    const widget = bars({
      compare: true,
      maxRange: "30d",
      query: async () => [{ label: "kwork", value: 5 }],
    });
    const tree = await renderWidget(widget, onRange(month), config, reqCtx);
    expect(cardRows(tree)).toEqual([{ label: "kwork", value: 5 }]);
  });
});
