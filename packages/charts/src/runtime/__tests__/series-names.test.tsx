import { DEFAULT_FORMATTING } from "@flowpanel/core/format";
import { isValidElement, type ReactElement } from "react";
import { Bar, Line } from "recharts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@flowpanel/react", () => ({
  useLabels: () => ({ widget: { empty: "No data yet" } }),
  useFormatting: () => DEFAULT_FORMATTING,
  formatNumber: (v: number) => String(v),
}));

import { BarChart } from "../BarChart";
import { LineChart } from "../LineChart";
import { seriesKeys } from "../series-keys";

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

const data = [{ date: "2026-09-01", kwork: 3, __other__: 2 }];

describe("series names", () => {
  it("reads y as a list and treats a missing y as no series", () => {
    expect(seriesKeys("value")).toEqual(["value"]);
    expect(seriesKeys(["a", "b"])).toEqual(["a", "b"]);
    expect(seriesKeys(undefined)).toEqual([]);
  });

  it("names each bar and line series from the names the server hands over", () => {
    const names = { kwork: "Kwork", __other__: "Other" };
    const barTree = BarChart({ data, options: { x: "date", y: ["kwork", "__other__"] }, names });
    expect(propsOf(barTree, Bar).map((p) => p.name)).toEqual(["Kwork", "Other"]);
    const lineTree = LineChart({ data, options: { x: "date", y: ["kwork"] }, names });
    expect(propsOf(lineTree, Line).map((p) => p.name)).toEqual(["Kwork"]);
  });

  it("falls back to the key without a name", () => {
    const tree = BarChart({ data, options: { x: "date", y: "kwork" } });
    expect(propsOf(tree, Bar).map((p) => p.name)).toEqual(["kwork"]);
  });
});
