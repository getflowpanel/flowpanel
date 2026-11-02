import { DEFAULT_FORMATTING } from "@flowpanel/core/format";
import { isValidElement, type ReactElement } from "react";
import { Area, Bar, Legend, Line } from "recharts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/react", () => ({
  useLabels: () => ({ widget: { empty: "No data yet" } }),
  useFormatting: () => DEFAULT_FORMATTING,
  formatNumber: (v: number) => String(v),
}));

import { AreaChart } from "../AreaChart";
import { BarChart } from "../BarChart";
import { LineChart } from "../LineChart";

function propsOf(node: unknown, type: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) propsOf(child, type, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Record<string, unknown> & { children?: unknown }>;
  if (el.type === type) out.push(el.props);
  propsOf(el.props.children, type, out);
  return out;
}

const data = [{ date: "2026-09-01", paid: 3, trial: 2 }];

describe("series colours", () => {
  it("paint one series in the data colour and several in chart order", () => {
    const one = LineChart({ data, options: { x: "date", y: "paid" } });
    expect(propsOf(one, Line)[0]?.stroke).toBe("hsl(var(--fp-data))");
    const two = BarChart({ data, options: { x: "date", y: ["paid", "trial"] } });
    expect(propsOf(two, Bar).map((p) => p.fill)).toEqual([
      "hsl(var(--fp-chart-1))",
      "hsl(var(--fp-chart-2))",
    ]);
  });

  it("take a colour per series key, so the headline need not move to the front", () => {
    const colors = { trial: "hsl(var(--fp-chart-1))", paid: "hsl(var(--fp-chart-2))" };
    const bar = BarChart({ data, options: { x: "date", y: ["paid", "trial"], colors } });
    expect(propsOf(bar, Bar).map((p) => p.fill)).toEqual([colors.paid, colors.trial]);
    const area = AreaChart({ data, options: { x: "date", y: ["paid", "trial"], colors } });
    expect(propsOf(area, Area).map((p) => p.stroke)).toEqual([colors.paid, colors.trial]);
    const line = LineChart({ data, options: { x: "date", y: "paid", colors: { paid: "red" } } });
    expect(propsOf(line, Line)[0]?.stroke).toBe("red");
  });

  it("write the legend in secondary text beside a coloured swatch", () => {
    const tree = LineChart({ data, options: { x: "date", y: ["paid", "trial"] } });
    const legend = propsOf(tree, Legend)[0] as { formatter: (v: string) => ReactElement };
    const label = legend.formatter("Paid") as ReactElement<{ style: { color: string } }>;
    expect(label.props.style.color).toBe("hsl(var(--fp-text-2))");
  });
});
