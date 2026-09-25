import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { metric, stat, table } from "@flowpanel/core";
import { MetricCard, StatStrip } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

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
  req: new Request("http://localhost/admin/strip"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

type Props = Record<string, unknown> & { children?: ReactNode };

function elements(tree: ReactNode, out: ReactElement<Props>[] = []): ReactElement<Props>[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) elements(child, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<Props>;
  out.push(el);
  return elements(el.props.children, out);
}

describe("strip sections", () => {
  it("renders a strip section as one StatStrip of plain metric and stat slots", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tree = await DashboardPage({
      config: cfg,
      dashboard: {
        path: "/strip",
        label: "Strip",
        sections: [
          {
            variant: "strip",
            columns: 4,
            widgets: [
              metric("Visits", async () => 3),
              stat("Runs", 5),
              table({ query: async () => [] }),
            ],
          },
        ],
      },
      searchParams: new URLSearchParams(),
      req: reqCtx.req,
      reqCtx,
    });
    const all = elements(tree);
    const strip = all.find((el) => el.type === StatStrip);
    expect(strip?.props.columns).toBe(4);
    const slots = elements(strip?.props.children).filter((el) => "widget" in el.props);
    expect(slots.map((el) => el.props.plain)).toEqual([true, true, false]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'dashboard "/strip" section 1 is a strip, which draws metric and stat widgets; a table widget renders as its own card there.',
      ),
    );
    warn.mockRestore();
  });

  it("renders a metric without its card frame when asked", async () => {
    const node = await renderWidget(
      metric("Visits", async () => 3),
      fakeWidgetContext(),
      cfg,
      reqCtx,
      { plain: true },
    );
    const card = elements(node).find((el) => el.type === MetricCard);
    expect(card?.props.plain).toBe(true);
  });
});
