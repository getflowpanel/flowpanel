import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { DEFAULT_LABELS } from "@flowpanel/core";
import { BarsCard, FunnelCard, KvCard, StatGroupCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { serializeWidget } from "../drawer/serialize-widget";
import { renderWidget } from "../runtime/render-widget";

const cfg = {
  basePath: "/admin",
  auth: { session: async () => null, role: () => "admin" },
  resources: [],
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

const ctx = {
  db: {},
  session: null,
  req: reqCtx.req,
  href: (resource: string) => `/admin/${resource}`,
  labels: DEFAULT_LABELS,
} as unknown as WidgetContext;

function findProps(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
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

const kv = {
  kind: "kv",
  options: {
    items: [
      {
        label: "Failed runs",
        value: async (c: WidgetContext) => ({ value: 3, tone: "err", href: c.href("runs") }),
        tone: "ok",
        href: "/admin/static",
      },
      { label: "Queued", value: async () => 5, tone: "warn", href: "/admin/queue" },
    ],
  },
} as unknown as WidgetConfig;

const group = {
  kind: "statGroup",
  options: {
    stats: [
      { label: "Errors", value: async () => ({ value: 2, tone: "err" }), tone: "ok" },
      { label: "Sent", value: 9, tone: "info" },
    ],
  },
} as unknown as WidgetConfig;

describe("a kv item resolver returning a KvResult", () => {
  it("drives the item's tone and link, with the static ones as the fallback", async () => {
    const props = findProps(await renderWidget(kv, ctx, cfg, reqCtx), KvCard);
    expect(props?.items).toEqual([
      { label: "Failed runs", value: "3", tone: "err", href: "/admin/runs" },
      { label: "Queued", value: "5", tone: "warn", href: "/admin/queue" },
    ]);
  });

  it("resolves the same way for the drawer", async () => {
    const out = (await serializeWidget(kv, cfg, reqCtx, ctx)) as { items: unknown[] };
    expect(out.items).toEqual([
      { label: "Failed runs", value: "3", tone: "err", href: "/admin/runs" },
      { label: "Queued", value: "5", tone: "warn", href: "/admin/queue" },
    ]);
  });
});

describe("a statGroup item resolver returning a KvResult", () => {
  it("drives the stat's tone, with the static one as the fallback", async () => {
    const props = findProps(await renderWidget(group, ctx, cfg, reqCtx), StatGroupCard);
    expect(props?.stats).toEqual([
      { label: "Errors", value: 2, tone: "err" },
      { label: "Sent", value: 9, tone: "info" },
    ]);
  });

  it("resolves the same way for the drawer", async () => {
    const out = (await serializeWidget(group, cfg, reqCtx, ctx)) as { stats: unknown[] };
    expect(out.stats).toEqual([
      { label: "Errors", value: 2, tone: "err" },
      { label: "Sent", value: 9, tone: "info" },
    ]);
  });
});

describe("a bars widget with a declared max", () => {
  const bars = {
    kind: "bars",
    options: { query: async () => [{ label: "Best", value: 0.45 }], format: "percent", max: 1 },
  } as unknown as WidgetConfig;

  it("hands the max to the card", async () => {
    expect(findProps(await renderWidget(bars, ctx, cfg, reqCtx), BarsCard)?.max).toBe(1);
  });

  it("keeps it for the drawer", async () => {
    expect(((await serializeWidget(bars, cfg, reqCtx, ctx)) as { max?: number }).max).toBe(1);
  });
});

describe("a funnel widget with an alertDrop", () => {
  const funnel = {
    kind: "funnel",
    options: { query: async () => [{ label: "Visited", value: 9 }], alertDrop: 0.3 },
  } as unknown as WidgetConfig;

  it("hands the threshold to the card", async () => {
    expect(findProps(await renderWidget(funnel, ctx, cfg, reqCtx), FunnelCard)?.alertDrop).toBe(
      0.3,
    );
  });

  it("keeps it for the drawer", async () => {
    const out = (await serializeWidget(funnel, cfg, reqCtx, ctx)) as { alertDrop?: number };
    expect(out.alertDrop).toBe(0.3);
  });
});
