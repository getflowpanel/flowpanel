import { DEFAULT_FORMATTING } from "@flowpanel/core/format";
import { isValidElement, type ReactElement } from "react";
import { Legend } from "recharts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/react", () => ({
  useLabels: () => ({ widget: { empty: "No data yet" } }),
  useFormatting: () => DEFAULT_FORMATTING,
  formatNumber: (v: number) => String(v),
  Card: ({ children }: { children?: unknown }) => children,
  CardHeader: ({ children }: { children?: unknown }) => children,
  CardHeading: () => null,
}));

import { ChartEmptyState } from "../ChartEmptyState";
import { ChartSkeleton } from "../ChartSkeleton";
import { PieChart } from "../PieChart";
import { chartBody, chartFrame } from "../render-chart";

function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (!isValidElement(node)) return "";
  return textOf((node.props as { children?: unknown }).children);
}

function findElements(node: unknown, type: unknown, out: unknown[] = []): unknown[] {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, type, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  if (node.type === type) out.push(node);
  const children = (node.props as { children?: unknown }).children;
  if (children !== undefined) findElements(children, type, out);
  return out;
}

const data = [{ status: "ok", count: 3 }];

describe("ChartEmptyState", () => {
  it("takes its wording from the admin's labels", () => {
    expect(textOf(ChartEmptyState({ height: 240 }))).toContain("No data yet");
  });
});

describe("PieChart legend", () => {
  it("shows the legend unless it is turned off", () => {
    const on = PieChart({ data, options: { category: "status", value: "count" } });
    expect(findElements(on, Legend)).toHaveLength(1);
  });

  it("omits the legend for showLegend: false", () => {
    const off = PieChart({
      data,
      options: { category: "status", value: "count", showLegend: false },
    });
    expect(findElements(off, Legend)).toHaveLength(0);
  });
});

describe("chartBody", () => {
  it("renders a skeleton of the chart's height until the chart mounts", () => {
    const body = chartBody(
      { kind: "pieChart", options: { category: "status", value: "count", height: 320 }, data },
      false,
    );
    expect(isValidElement(body)).toBe(true);
    const el = body as { type: unknown; props: { height?: number } };
    expect(el.type).toBe(ChartSkeleton);
    expect(el.props.height).toBe(320);
  });

  it("falls back to the shared default height", () => {
    const body = chartBody(
      { kind: "barChart", options: { x: "status", y: "count" }, data },
      false,
    ) as { props: { height?: number } };
    expect(body.props.height).toBe(240);
  });

  it("renders the chart once mounted", () => {
    const body = chartBody(
      { kind: "pieChart", options: { category: "status", value: "count" }, data },
      true,
    ) as { type: unknown };
    expect(body.type).toBe(PieChart);
  });
});

describe("chartFrame", () => {
  it("links the card to the drilldown the server resolved", () => {
    const framed = chartFrame(<div>card</div>, {
      label: "Runs",
      drilldown: "/admin/ai_run",
    }) as ReactElement<{ href: string; "aria-label"?: string; className: string }>;
    expect(framed.type).toBe("a");
    expect(framed.props.className).toContain("focus-visible:ring-2");
    expect(framed.props.className).toContain("h-full");
    expect(framed.props.href).toBe("/admin/ai_run");
    expect(framed.props["aria-label"]).toBe("Runs");
  });

  it("leaves a card without a drilldown unlinked", () => {
    const card = <div>card</div>;
    expect(chartFrame(card, { label: "Runs" })).toBe(card);
  });
});
