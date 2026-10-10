// @vitest-environment happy-dom

import type { RequestContext, ResolvedAdminConfig, WidgetConfig } from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { FormattingProvider, KvCard, StatCard, StatGroupCard } from "@flowpanel/react";
import { cleanup, render } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const JOINED = new Date("2026-09-22T23:30:00.000Z");

function admin(timeZone?: string, locale?: string): ResolvedAdminConfig {
  return {
    paths: { admin: "/admin", api: "/api/flowpanel" },
    adapter: { kind: "drizzle", db: {}, introspect: () => ({ name: "x", columns: [] }) },
    auth: { session: async () => null, role: () => "admin" },
    formatting: { ...(timeZone ? { timeZone } : {}), ...(locale ? { locale } : {}) },
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

const ctx = fakeWidgetContext();

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

afterEach(cleanup);

async function painted(widget: WidgetConfig, config: ResolvedAdminConfig): Promise<string> {
  const node = await renderWidget(widget, ctx, config, reqCtx);
  const { container } = render(
    <FormattingProvider value={resolveFormatting(config.formatting)}>{node}</FormattingProvider>,
  );
  const html = container.innerHTML;
  cleanup();
  return html;
}

const statWidget = { kind: "stat", label: "Joined", value: async () => JOINED, options: {} };
const groupWidget = {
  kind: "statGroup",
  options: { stats: [{ label: "Joined", value: async () => JOINED }] },
};
const kvWidget = { kind: "kv", options: { items: [{ label: "Joined", value: JOINED }] } };
const instant = { kind: "date", iso: "2026-09-22T23:30:00.000Z" };

describe("a Date in a card renders through LocalTime, like a datetime column", () => {
  it("hands a stat, a statGroup row and a kv item the instant rather than a server string", async () => {
    const config = admin();
    expect((await rendered(statWidget as never, StatCard, config))?.value).toEqual(instant);
    const group = (await rendered(groupWidget as never, StatGroupCard, config))?.stats as {
      value: unknown;
    }[];
    expect(group[0]?.value).toEqual(instant);
    const items = (await rendered(kvWidget as never, KvCard, config))?.items as {
      value: unknown;
    }[];
    expect(items[0]?.value).toEqual(instant);
  });

  it("paints a time element in every card", async () => {
    for (const widget of [statWidget, groupWidget, kvWidget]) {
      const html = await painted(widget as never, admin());
      expect(html).toMatch(/<time datetime="2026-09-22T23:30:00.000Z" title="[^"]+">/i);
    }
  });

  it("paints the configured zone", async () => {
    for (const widget of [statWidget, groupWidget, kvWidget]) {
      expect(await painted(widget as never, admin("UTC"))).toContain("2026-09-22 23:30");
      expect(await painted(widget as never, admin("Asia/Bangkok"))).toContain("2026-09-23 06:30");
    }
  });

  it("follows a configured locale, the way a table cell does", async () => {
    expect(await painted(statWidget as never, admin("UTC", "de-DE"))).toContain("22.09.2026 23:30");
  });

  it("keeps a day format a server string", async () => {
    const dayWidget = {
      kind: "kv",
      options: { items: [{ label: "Joined", value: JOINED, format: "date" }] },
    };
    const items = (await rendered(dayWidget as never, KvCard, admin("Asia/Bangkok")))?.items as {
      value: unknown;
    }[];
    expect(items[0]?.value).toBe("2026-09-23");
  });
});
