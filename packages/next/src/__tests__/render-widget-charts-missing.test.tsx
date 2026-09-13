import type {
  RequestContext,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { DEFAULT_LABELS, RU_LABELS } from "@flowpanel/core";
import { isValidElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/charts/runtime", () => {
  throw new Error("Cannot find module '@flowpanel/charts/runtime'");
});

import { renderWidget } from "../runtime/render-widget";

const cfg: ResolvedAdminConfig = {
  basePath: "/admin",
  adapter: { kind: "drizzle", db: {} },
  auth: { session: async () => null, role: () => "admin" },
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

function ctx(labels: WidgetContext["labels"]): WidgetContext {
  return {
    db: {},
    session: null,
    dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
    req: new Request("http://localhost/"),
    href: (resource) => `/admin/${resource}`,
    query: (_key, fn) => fn(),
    labels,
  };
}

const widget: WidgetConfig = {
  kind: "pieChart",
  label: "Split",
  query: async () => [],
  options: { category: "a", value: "b" },
} as never;

describe("renderWidget without @flowpanel/charts", () => {
  it("says the package is missing in the admin's configured language", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const english = await renderWidget(widget, ctx(DEFAULT_LABELS), cfg, reqCtx);
    expect(isValidElement(english)).toBe(true);
    expect((english as ReactElement<{ children: string }>).props.children).toBe(
      DEFAULT_LABELS.widget.chartsMissing,
    );

    const russian = await renderWidget(widget, ctx(RU_LABELS), cfg, reqCtx);
    expect((russian as ReactElement<{ children: string }>).props.children).toBe(
      RU_LABELS.widget.chartsMissing,
    );
  });
});
