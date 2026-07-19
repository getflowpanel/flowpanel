import { isValidElement, type ReactElement } from "react";
import { Tooltip } from "recharts";
import { describe, expect, it } from "vitest";
import { ChartTooltip, type ChartTooltipProps } from "../ChartTooltip.js";
import { PieChart } from "../PieChart.js";

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

const data = [
  { status: "success", count: 1234 },
  { status: "failed", count: 56 },
];

/** Flatten a returned element tree to its text, so assertions read as output. */
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(" ");
  if (!isValidElement(node)) return "";
  return textOf((node.props as { children?: unknown }).children);
}

describe("PieChart", () => {
  it("formats tooltip values through the shared NumericFormat formatter", () => {
    const el = PieChart({
      data,
      options: { category: "status", value: "count", format: "currency" },
    });
    const [tooltip] = findElements(el, Tooltip) as {
      props: { content?: ReactElement<ChartTooltipProps> };
    }[];
    expect(tooltip).toBeTruthy();
    const rendered = ChartTooltip({
      ...(tooltip?.props.content as ReactElement<ChartTooltipProps>).props,
      active: true,
      label: "success",
      payload: [{ name: "success", value: 1234, color: "#000", dataKey: "count" }],
    });
    expect(textOf(rendered)).toContain("$1,234");
  });

  it("renders no Tooltip element when tooltip is false", () => {
    const el = PieChart({ data, options: { category: "status", value: "count", tooltip: false } });
    const tooltips = findElements(el, Tooltip);
    expect(tooltips).toHaveLength(0);
  });

  it("drops the tooltip header for tooltip: compact", () => {
    const el = PieChart({
      data,
      options: { category: "status", value: "count", tooltip: "compact" },
    });
    const [tooltip] = findElements(el, Tooltip) as {
      props: { content?: ReactElement<ChartTooltipProps> };
    }[];
    const props = (tooltip?.props.content as ReactElement<ChartTooltipProps>).props;
    expect(props.compact).toBe(true);
    const rendered = ChartTooltip({
      ...props,
      active: true,
      label: "2026-08-12",
      payload: [{ name: "success", value: 7, color: "#000", dataKey: "count" }],
    });
    expect(textOf(rendered)).not.toContain("2026-08-12");
    expect(textOf(rendered)).toContain("success");
  });
});

describe("ChartTooltip", () => {
  it("totals the series only when there is more than one to add up", () => {
    const one = ChartTooltip({
      active: true,
      label: "12:00",
      payload: [{ name: "a", value: 5, color: "#000", dataKey: "a" }],
    });
    // A lone series would otherwise print its own value twice.
    expect(textOf(one).match(/5/g)).toHaveLength(1);

    const two = ChartTooltip({
      active: true,
      label: "12:00",
      payload: [
        { name: "a", value: 5, color: "#000", dataKey: "a" },
        { name: "b", value: 7, color: "#111", dataKey: "b" },
      ],
    });
    expect(textOf(two)).toContain("12");
  });

  it("renders nothing when inactive or empty", () => {
    expect(ChartTooltip({ active: false, payload: [] })).toBeNull();
    expect(ChartTooltip({ active: true, payload: [] })).toBeNull();
  });
});
