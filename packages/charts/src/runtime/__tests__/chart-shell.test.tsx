import { DEFAULT_FORMATTING } from "@flowpanel/core/format";
import { type CSSProperties, isValidElement, type ReactElement, Suspense } from "react";
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
    expect(textOf(ChartEmptyState())).toContain("No data yet");
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
  it("renders a skeleton of the chart's set height until the chart mounts", () => {
    const body = chartBody(
      { kind: "pieChart", options: { category: "status", value: "count", height: 320 }, data },
      false,
    );
    expect(isValidElement(body)).toBe(true);
    const el = body as { type: unknown; props: { style?: CSSProperties } };
    expect(el.type).toBe(ChartSkeleton);
    expect(el.props.style).toEqual({ height: 320 });
  });

  it("without a set height, takes 2/7 of its width within 240 to 320 px", () => {
    const body = chartBody(
      { kind: "barChart", options: { x: "status", y: "count" }, data },
      false,
    ) as { props: { style?: CSSProperties } };
    expect(body.props.style).toEqual({
      width: "100%",
      aspectRatio: "7 / 2",
      minHeight: 240,
      maxHeight: 320,
    });
  });

  it("once mounted, hands the rows to the frame that measures the box", () => {
    const props = { kind: "barChart" as const, options: { x: "status", y: "count" }, data };
    const body = chartBody(props, true) as ReactElement<typeof props>;
    expect(body.type).not.toBe(Suspense);
    expect(body.props).toEqual(props);
  });

  it("draws an empty chart's message without holding the box", async () => {
    const props = {
      kind: "pieChart" as const,
      options: { category: "status", value: "count" },
      data: [],
    };
    const body = chartBody(props, true) as ReactElement<{ children: ReactElement }>;
    expect(body.type).toBe(Suspense);
    const { default: ChartBody } = await import("../chart-body");
    expect(ChartBody({ ...props, data })?.type).toBe(PieChart);
  });
});

describe("chartFrame", () => {
  it("links the card to the drilldown the server resolved", () => {
    const framed = chartFrame(<div>card</div>, {
      label: "Runs",
      drilldown: "/admin/ai_run",
    }) as ReactElement<{ href: string; "aria-label"?: string; className: string }>;
    expect(framed.type).toBe("a");
    expect(framed.props.className).toContain("focus-visible:fp-ring-2");
    expect(framed.props.className).toContain("fp-h-full");
    expect(framed.props.href).toBe("/admin/ai_run");
    expect(framed.props["aria-label"]).toBe("Runs");
  });

  it("leaves a card without a drilldown unlinked", () => {
    const card = <div>card</div>;
    expect(chartFrame(card, { label: "Runs" })).toBe(card);
  });
});
