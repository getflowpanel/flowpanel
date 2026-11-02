import { DEFAULT_FORMATTING } from "@flowpanel/core/format";
import { isValidElement, type ReactElement } from "react";
import { XAxis, YAxis } from "recharts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/react", () => ({
  useLabels: () => ({ widget: { empty: "No data yet" } }),
  useFormatting: () => DEFAULT_FORMATTING,
  formatNumber: (v: number) => String(v),
}));

import { BarChart } from "../BarChart";

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

const days = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-09-${String(i + 1).padStart(2, "0")}`,
  runs: i,
}));

describe("bar chart ticks", () => {
  it("lets a vertical chart thin its category ticks so labels never overlap", () => {
    const [x] = propsOf(BarChart({ data: days, options: { x: "day", y: "runs" } }), XAxis);
    expect(x?.interval).toBe("preserveStartEnd");
    expect(x?.minTickGap).toBeGreaterThan(0);
  });

  it("keeps a label on every row of a horizontal chart", () => {
    const tree = BarChart({ data: days, options: { x: "day", y: "runs", horizontal: true } });
    const [y] = propsOf(tree, YAxis);
    expect(y?.interval).toBe(0);
  });
});
