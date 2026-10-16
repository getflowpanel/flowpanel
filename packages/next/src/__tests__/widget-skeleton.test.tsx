import { areaChart, custom, metric, table } from "@flowpanel/core";
import { Children, isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { widgetSkeleton, widgetSkeletonHeight } from "../pages/widget-skeleton";

const Empty = () => null;

function boxOf(node: ReactNode): unknown {
  if (!isValidElement<{ style?: unknown; children?: ReactNode }>(node)) return undefined;
  if (node.props.style) return node.props.style;
  for (const child of Children.toArray(node.props.children)) {
    const found = boxOf(child);
    if (found) return found;
  }
  return undefined;
}

describe("a widget's placeholder height", () => {
  it("holds a KPI card, taller with a comparison", () => {
    expect(widgetSkeletonHeight(metric("Runs", { count: "runs" }))).toBe(116);
    expect(widgetSkeletonHeight(metric("Runs", { count: "runs" }, { compare: true }))).toBe(136);
  });

  it("holds at most five table rows, so a short table does not pull the page up", () => {
    expect(widgetSkeletonHeight(table({ resource: "runs" }))).toBe(92 + 5 * 53);
    expect(widgetSkeletonHeight(table({ resource: "runs", limit: 3 }))).toBe(92 + 3 * 53);
    expect(widgetSkeletonHeight(table({ resource: "runs", limit: 3, density: "compact" }))).toBe(
      92 + 3 * 40,
    );
  });

  it("holds a custom widget's minHeight", () => {
    expect(widgetSkeletonHeight(custom(Empty, {}, { minHeight: 437 }))).toBe(437);
    expect(widgetSkeletonHeight(custom(Empty, {}))).toBe(80);
  });

  it("holds a chart in the chart's own box, its set height or 2/7 of its width", () => {
    const set = areaChart("Revenue", async () => [], { x: "day", y: "total", height: 300 });
    expect(boxOf(widgetSkeleton(set))).toEqual({ height: 300 });
    const auto = areaChart("Revenue", async () => [], { x: "day", y: "total" });
    expect(boxOf(widgetSkeleton(auto))).toEqual({
      width: "100%",
      aspectRatio: "7 / 2",
      minHeight: 240,
      maxHeight: 320,
    });
  });

  it("keeps a line for a chart's caption, and none for a chart without heading", () => {
    const lines = (node: ReactNode): number => {
      if (!isValidElement<{ className?: string; children?: ReactNode }>(node)) return 0;
      const own = node.props.className?.includes("fp-h-4") ? 1 : 0;
      return (
        own +
        Children.toArray(node.props.children).reduce<number>((sum, child) => sum + lines(child), 0)
      );
    };
    const fresh = areaChart("Revenue", async () => [], {
      x: "day",
      y: "total",
      freshness: { at: async () => null },
    });
    expect(lines(widgetSkeleton(fresh))).toBe(1);
    expect(
      lines(widgetSkeleton(areaChart("Revenue", async () => [], { x: "day", y: "total" }))),
    ).toBe(0);
  });
});
