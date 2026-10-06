import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { metric } from "@flowpanel/core";
import { MetricCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
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
const thisWeek = (c: WidgetContext) => c.dateRange.from.getTime() === week.from.getTime();

function findProps(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findProps(child, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === target) return el.props;
  return findProps(el.props.children, target);
}

async function deltaOf(
  widget: WidgetConfig,
  ctx = buildWidgetContext(config, reqCtx, reqCtx.req, week),
) {
  return findProps(await renderWidget(widget, ctx, config, reqCtx), MetricCard)?.delta;
}

describe("metric({ compare })", () => {
  it("queries the previous period and derives the change", async () => {
    const widget = metric("Signups", async (c) => (thisWeek(c) ? 120 : 100), { compare: true });
    expect(await deltaOf(widget)).toEqual({ value: 0.2, vs: "vs previous period", previous: 100 });
  });

  it("reads a zero base as the sign of the change", async () => {
    const widget = metric("Errors", async (c) => (thisWeek(c) ? 3 : 0), {
      compare: true,
      goodWhen: "down",
    });
    expect(await deltaOf(widget)).toEqual({
      value: 1,
      vs: "vs previous period",
      previous: 0,
    });
  });

  it("lets a delta the query returned win", async () => {
    const widget = metric(
      "Signups",
      async () => ({ value: 5, delta: { value: 0.5, vs: "custom" } }),
      {
        compare: true,
      },
    );
    expect(await deltaOf(widget)).toEqual({ value: 0.5, vs: "custom" });
  });

  it("skips the comparison for a text value and in a detail tab", async () => {
    expect(await deltaOf(metric("Plan", async () => "Pro", { compare: true }))).toBeNull();
    const detail = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), {
      id: "u1",
    });
    expect(
      await deltaOf(
        metric("Orders", async () => 4, { compare: true }),
        detail,
      ),
    ).toBeNull();
  });

  it("runs a keyed query again for the previous period", async () => {
    const widget = metric(
      "Signups",
      (c) => c.query("signups", async () => (thisWeek(c) ? 120 : 100)),
      { compare: true },
    );
    expect(await deltaOf(widget)).toMatchObject({ previous: 100 });
  });

  it("compares with the same range a week earlier", async () => {
    const seen: string[] = [];
    const widget = metric(
      "Signups",
      async (c) => {
        seen.push(c.dateRange.from.toISOString());
        return thisWeek(c) ? 120 : 100;
      },
      { compare: { against: "weekAgo" } },
    );
    expect(await deltaOf(widget)).toEqual({ value: 0.2, vs: "vs a week earlier", previous: 100 });
    expect(seen).toContain("2026-09-07T00:00:00.000Z");
  });
});
