import type { RequestContext, ResolvedAdminConfig, WidgetContext } from "@flowpanel/core";
import { metric, stat } from "@flowpanel/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../pages/dashboard";
import { renderSlots } from "../pages/detail-page/widget-slots";
import { renderWidget } from "../runtime/render-widget";
import { buildWidgetContext } from "../runtime/widget-context";
import { fakeWidgetContext } from "./widget-context-fixture";

const cfg: ResolvedAdminConfig = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  adapter: { kind: "drizzle", db: {} },
  auth: { session: async () => null, role: () => "support" },
  resources: [],
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  __resolved: true,
} as never;

const as = (role: string): RequestContext => ({
  req: new Request("http://localhost/admin"),
  session: null,
  role,
  scope: null,
  ip: null,
  userAgent: null,
});

type Props = Record<string, unknown> & { children?: ReactNode };

function slotWidgets(tree: ReactNode, out: unknown[] = []): unknown[] {
  if (tree === null || tree === undefined || typeof tree !== "object") return out;
  if (Array.isArray(tree)) {
    for (const child of tree) slotWidgets(child, out);
    return out;
  }
  if (!isValidElement(tree)) return out;
  const el = tree as ReactElement<Props>;
  if ("widget" in el.props) out.push(el.props.widget);
  return slotWidgets(el.props.children, out);
}

describe("a widget's access", () => {
  const mrr = vi.fn(async () => 1200);
  const revenue = metric("MRR", mrr, { access: "admin" });
  const open = stat("Open tickets", 4);

  async function dashboardFor(role: string) {
    mrr.mockClear();
    const tree = await DashboardPage({
      config: cfg,
      dashboard: {
        path: "/",
        label: "Overview",
        sections: [{ widgets: [revenue, open] }, { label: "Revenue", widgets: [revenue] }],
      },
      searchParams: new URLSearchParams(),
      req: as(role).req,
      reqCtx: as(role),
    });
    return { widgets: slotWidgets(tree), sections: JSON.stringify(tree).includes("Revenue") };
  }

  it("leaves a refused widget, and a section it empties, off the dashboard", async () => {
    expect(await dashboardFor("admin")).toEqual({
      widgets: [revenue, open, revenue],
      sections: true,
    });
    expect(await dashboardFor("support")).toEqual({ widgets: [open], sections: false });
  });

  it("never runs a refused widget's query, on a record page or through renderWidget", async () => {
    mrr.mockClear();
    const ctx: WidgetContext = fakeWidgetContext({ role: "support" });
    const slots = await renderSlots([revenue, open], ctx, cfg, as("support"), "orders aside");
    expect(slots.map((slot) => slot.owner.label)).toEqual(["Open tickets"]);
    expect(await renderWidget(revenue, ctx, cfg, as("support"))).toBeNull();
    expect(mrr).not.toHaveBeenCalled();
  });

  it("puts the caller's role on the widget context", () => {
    const range = { from: new Date(0), to: new Date(), preset: "custom" as const };
    expect(buildWidgetContext(cfg, as("support"), as("support").req, range).role).toBe("support");
  });
});
