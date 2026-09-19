import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { DEFAULT_LABELS } from "@flowpanel/core";
import { BarsCard, FunnelCard, KvCard, ListCard, MetricCard, StatCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";

const cfg: ResolvedAdminConfig = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {}, introspect: () => ({ name: "x", columns: [] }) },
  auth: { session: async () => null, role: () => "admin" },
  formatting: { locale: "en-US", currency: "EUR" },
  resources: [],
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  __resolved: true,
} as never;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const ctx: WidgetContext = {
  db: {},
  session: null,
  dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
  req: new Request("http://localhost/"),
  href: (resource, id) => (id === undefined ? `/admin/${resource}` : `/admin/${resource}/${id}`),
  query: (_key, fn) => fn(),
  labels: DEFAULT_LABELS,
  sql: async () => [],
  count: async () => 0,
};

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

async function rendered(widget: WidgetConfig, target: unknown) {
  return findProps(await renderWidget(widget, ctx, cfg, reqCtx), target);
}

describe("metric widget result object", () => {
  it("drives tone, sublabel, delta and the drilldown from the query's own result", async () => {
    const props = await rendered(
      {
        kind: "metric",
        label: "MRR",
        query: async () => ({
          value: 4200,
          tone: "ok",
          sublabel: "net of refunds",
          delta: { value: 0.12, vs: "prior period" },
          href: "/admin/invoices",
        }),
        options: { tone: "warn", sublabel: "static", drilldown: "/admin/other" },
      } as never,
      MetricCard,
    );
    expect(props?.value).toBe(4200);
    expect(props?.tone).toBe("ok");
    expect(props?.sublabel).toBe("net of refunds");
    expect(props?.drilldown).toBe("/admin/invoices");
    expect(props?.delta).toEqual({ value: 0.12, vs: "prior period" });
  });

  it("keeps the static options as fallbacks for a bare value", async () => {
    const props = await rendered(
      {
        kind: "metric",
        label: "MRR",
        query: async () => 7,
        options: { tone: "warn", sublabel: "static", drilldown: "/admin/other" },
      } as never,
      MetricCard,
    );
    expect(props?.value).toBe(7);
    expect(props?.tone).toBe("warn");
    expect(props?.sublabel).toBe("static");
    expect(props?.drilldown).toBe("/admin/other");
  });

  it("carries goodWhen through to the card", async () => {
    const props = await rendered(
      {
        kind: "metric",
        label: "Churn",
        query: async () => ({ value: 3, delta: { value: -0.2, vs: "prior", goodWhen: "down" } }),
        options: {},
      } as never,
      MetricCard,
    );
    expect(props?.delta).toEqual({ value: -0.2, vs: "prior", goodWhen: "down" });
  });
});

describe("stat widget", () => {
  it("resolves a function value and forwards the options", async () => {
    const props = await rendered(
      {
        kind: "stat",
        label: "Signups",
        value: async () => 42,
        options: { hint: "last 7 days", tone: "ok", href: "/admin/users", format: "number" },
      } as never,
      StatCard,
    );
    expect(props).toMatchObject({
      label: "Signups",
      value: 42,
      hint: "last 7 days",
      tone: "ok",
      href: "/admin/users",
    });
  });
});

describe("kv widget", () => {
  it("formats each item with the admin's own currency", async () => {
    const props = await rendered(
      {
        kind: "kv",
        options: {
          items: [
            { label: "Balance", value: 1200, format: "money" },
            { label: "Rate", value: 0.25, format: "percent" },
            { label: "Plan", value: "Pro" },
            { label: "Owner", value: null },
          ],
        },
      } as never,
      KvCard,
    );
    const items = props?.items as { label: string; value: string }[];
    expect(items[0]?.value).toBe("€1,200.00");
    expect(items[1]?.value).toBe("25%");
    expect(items[2]?.value).toBe("Pro");
    expect(items[3]?.value).toBe("—");
  });
});

describe("bars, funnel and list widgets", () => {
  it("hand their query's rows to the card and fall back to the empty label", async () => {
    const bars = await rendered(
      { kind: "bars", options: { query: async () => [{ label: "Pro", value: 3 }] } } as never,
      BarsCard,
    );
    expect(bars?.rows).toEqual([{ label: "Pro", value: 3 }]);
    expect(bars?.emptyState).toBe(DEFAULT_LABELS.widget.empty);

    const funnel = await rendered(
      {
        kind: "funnel",
        options: { query: async () => [{ label: "Visited", value: 9 }], emptyState: "Quiet" },
      } as never,
      FunnelCard,
    );
    expect(funnel?.steps).toEqual([{ label: "Visited", value: 9 }]);
    expect(funnel?.emptyState).toBe("Quiet");

    const list = await rendered(
      { kind: "list", options: { query: async () => [{ text: "ann" }] } } as never,
      ListCard,
    );
    expect(list?.rows).toEqual([{ text: "ann" }]);
  });
});
