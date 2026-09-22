import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { DEFAULT_LABELS } from "@flowpanel/core";
import { KvCard, StatCard, StatGroupCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";

const JOINED = new Date("2026-09-22T23:30:00.000Z");

function admin(timeZone: string, locale?: string): ResolvedAdminConfig {
  return {
    basePath: "/admin",
    adapter: { kind: "drizzle", db: {}, introspect: () => ({ name: "x", columns: [] }) },
    auth: { session: async () => null, role: () => "admin" },
    formatting: { timeZone, ...(locale ? { locale } : {}) },
    resources: [],
    resourcesByName: new Map(),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
}

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
  href: (resource) => `/admin/${resource}`,
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

async function rendered(widget: WidgetConfig, target: unknown, config: ResolvedAdminConfig) {
  return findProps(await renderWidget(widget, ctx, config, reqCtx), target);
}

const statWidget = { kind: "stat", label: "Joined", value: async () => JOINED, options: {} };
const groupWidget = {
  kind: "statGroup",
  options: { stats: [{ label: "Joined", value: async () => JOINED }] },
};
const kvWidget = { kind: "kv", options: { items: [{ label: "Joined", value: JOINED }] } };

describe("a Date in a card goes through the admin's formatting", () => {
  it("renders a stat, a statGroup row and a kv item in the configured zone", async () => {
    const utc = admin("UTC");
    expect((await rendered(statWidget as never, StatCard, utc))?.value).toBe("2026-09-22 23:30");
    const group = (await rendered(groupWidget as never, StatGroupCard, utc))?.stats as {
      value: unknown;
    }[];
    expect(group[0]?.value).toBe("2026-09-22 23:30");
    const items = (await rendered(kvWidget as never, KvCard, utc))?.items as { value: string }[];
    expect(items[0]?.value).toBe("2026-09-22 23:30");
  });

  it("moves the same instant to the day the admin's zone is on", async () => {
    const bangkok = admin("Asia/Bangkok");
    expect((await rendered(statWidget as never, StatCard, bangkok))?.value).toBe(
      "2026-09-23 06:30",
    );
    const items = (await rendered(kvWidget as never, KvCard, bangkok))?.items as {
      value: string;
    }[];
    expect(items[0]?.value).toBe("2026-09-23 06:30");
  });

  it("follows a configured locale, the way a table cell does", async () => {
    const props = await rendered(statWidget as never, StatCard, admin("UTC", "de-DE"));
    expect(props?.value).toBe("22.09.2026 23:30");
  });
});
