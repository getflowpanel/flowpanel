import { isValidElement } from "react";
import { Tooltip } from "recharts";
import { describe, expect, it } from "vitest";
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

describe("PieChart", () => {
  it("formats tooltip values through the shared NumericFormat formatter", () => {
    const el = PieChart({
      data,
      options: { category: "status", value: "count", format: "currency" },
    });
    const [tooltip] = findElements(el, Tooltip) as {
      props: { formatter?: (v: unknown) => unknown };
    }[];
    expect(tooltip).toBeTruthy();
    expect(tooltip?.props.formatter?.(1234)).toBe("$1,234");
  });

  it("renders no Tooltip element when tooltip is false", () => {
    const el = PieChart({ data, options: { category: "status", value: "count", tooltip: false } });
    const tooltips = findElements(el, Tooltip);
    expect(tooltips).toHaveLength(0);
  });

  it("tightens tooltip chrome for tooltip: compact", () => {
    const el = PieChart({
      data,
      options: { category: "status", value: "count", tooltip: "compact" },
    });
    const [tooltip] = findElements(el, Tooltip) as {
      props: { contentStyle?: { fontSize?: number } };
    }[];
    expect(tooltip?.props.contentStyle?.fontSize).toBe(12);
  });
});
