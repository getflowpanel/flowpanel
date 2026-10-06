import type { RequestContext, ResolvedAdminConfig, WidgetConfig } from "@flowpanel/core";
import { bars, metric, stat } from "@flowpanel/core";
import { BarsCard, MetricCard, StatCard } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const config = {
  paths: { admin: "/admin", api: "/api/flowpanel" },
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  pagesByPath: new Map(),
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

const ERR = { warn: 0.3, err: 0.5, min: 20 };

function propsOf(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = propsOf(child, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  return el.type === target ? el.props : propsOf(el.props.children, target);
}

const render = async (widget: WidgetConfig, target: unknown) =>
  propsOf(await renderWidget(widget, fakeWidgetContext(), config, reqCtx), target);

describe("tones from a threshold", () => {
  it("tones a metric, and mutes it below the minimum volume", async () => {
    const hot = metric("Errors", async () => ({ value: 0.6, volume: 40 }), { tones: ERR });
    expect((await render(hot, MetricCard))?.tone).toBe("err");
    const thin = metric("Errors", async () => ({ value: 0.6, volume: 5 }), { tones: ERR });
    expect((await render(thin, MetricCard))?.tone).toBe("muted");
  });

  it("lets an explicit tone win", async () => {
    const widget = metric("Errors", async () => ({ value: 0.6, tone: "info" as const }), {
      tones: ERR,
    });
    expect((await render(widget, MetricCard))?.tone).toBe("info");
  });

  it("tones a stat and each bar", async () => {
    expect((await render(stat("Errors", 0.35, { tones: ERR }), StatCard))?.tone).toBe("warn");
    const rows = (
      await render(
        bars({
          tones: { warn: 0.3, err: 0.5 },
          query: async () => [
            { label: "kwork", value: 0.6 },
            { label: "fl", value: 0.1 },
            { label: "habr", value: 0.9, tone: "info" as const },
          ],
        }),
        BarsCard,
      )
    )?.rows as Array<{ tone?: string }>;
    expect(rows.map((row) => row.tone)).toEqual(["err", "ok", "info"]);
  });
});

describe("a card with no value", () => {
  it("mutes its dash whether or not it declares a threshold", async () => {
    const plain = stat("Last run", async () => null);
    const toned = stat("Failed", async () => null, { tones: ERR, tone: "err" });
    expect((await render(plain, StatCard))?.tone).toBe("muted");
    expect((await render(toned, StatCard))?.tone).toBe("muted");
  });

  it("keeps the tone its query returned", async () => {
    const said = stat("Last run", async () => ({ value: null, tone: "err" as const }));
    expect((await render(said, StatCard))?.tone).toBe("err");
  });
});
