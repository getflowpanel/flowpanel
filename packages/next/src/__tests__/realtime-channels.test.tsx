import type { RequestContext, ResolvedAdminConfig, WidgetConfig } from "@flowpanel/core";
import { list, metric } from "@flowpanel/core";
import { RealtimeRefresh } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { realtimeChannels, realtimeProp } from "../runtime/realtime-channels";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const config = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  resources: [],
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
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

function channelsOf(tree: ReactNode): unknown {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = channelsOf(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<{ channels?: unknown; children?: ReactNode }>;
  if (el.type === RealtimeRefresh) return el.props.channels;
  return channelsOf(el.props.children);
}

describe("realtimeChannels", () => {
  it("turns { resource } into the resource's channel and keeps names", () => {
    expect(realtimeChannels({ resource: "orders" })).toBe("resource.orders");
    expect(realtimeChannels("pipeline")).toBe("pipeline");
    expect(realtimeChannels([{ resource: "runs" }, "pipeline"])).toEqual([
      "resource.runs",
      "pipeline",
    ]);
    expect(realtimeChannels(undefined)).toBeUndefined();
  });

  it("spreads into a wire or a prop only when there is something to subscribe to", () => {
    expect(realtimeProp({ resource: "runs" })).toEqual({ realtime: "resource.runs" });
    expect(realtimeProp(undefined)).toEqual({});
  });
});

describe("renderWidget with a { resource } target", () => {
  it("subscribes a metric to the resource's channel", async () => {
    const widget = metric("Runs", async () => 1, { realtime: { resource: "runs" } });
    const node = await renderWidget(widget, fakeWidgetContext(), config, reqCtx);
    expect(channelsOf(node)).toBe("resource.runs");
  });

  it("subscribes a list to a mix of targets", async () => {
    const widget = list({
      query: async () => [],
      realtime: ["pipeline", { resource: "scraper_run" }],
    }) as WidgetConfig;
    const node = await renderWidget(widget, fakeWidgetContext(), config, reqCtx);
    expect(channelsOf(node)).toEqual(["pipeline", "resource.scraper_run"]);
  });
});
