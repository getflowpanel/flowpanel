import type { BarChartWidget, LineChartWidget, PieChartWidget } from "@flowpanel/core";
import { DEFAULT_LABELS, enumOf, OTHER_KEY } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { chartProps, chartRows } from "../runtime/chart-props";

const byDay = [{ date: "2026-09-01", kwork: 3, fl: 1, [OTHER_KEY]: 2 }];

function bar(options: BarChartWidget["options"]): BarChartWidget {
  return { kind: "barChart", label: "Orders", query: async () => byDay, options };
}

describe("chartProps", () => {
  it("plots every column but x when y is left out, and names the folded rest", () => {
    expect(chartProps(bar({ x: "date" }), byDay, DEFAULT_LABELS)).toEqual({
      options: { x: "date", y: ["kwork", "fl", OTHER_KEY] },
      seriesLabels: { kwork: "kwork", fl: "fl", [OTHER_KEY]: "Other" },
    });
  });

  it("infers y from only the numeric keys of the first row, not a label column", () => {
    const rows = [{ date: "2026-09-01", label: "Sep 1", value: 3 }];
    expect(chartProps(bar({ x: "date" }), rows, DEFAULT_LABELS)).toEqual({
      options: { x: "date", y: ["value"] },
      seriesLabels: { value: "value" },
    });
  });

  it("names series from a map or an enumOf, and hands no link or labels to the client", () => {
    const Platform = enumOf({ kwork: "Kwork", fl: "FL.ru" });
    const widget = bar({ x: "date", y: ["kwork", "fl"], labels: Platform, drilldown: "/x" });
    expect(chartProps(widget, byDay, DEFAULT_LABELS)).toEqual({
      options: { x: "date", y: ["kwork", "fl"] },
      seriesLabels: { kwork: "Kwork", fl: "FL.ru" },
    });
    const line: LineChartWidget = {
      kind: "lineChart",
      label: "Visits",
      query: async () => [],
      options: { x: "date", y: "value", labels: { value: "Визиты" } },
    };
    expect(chartProps(line, [], DEFAULT_LABELS).seriesLabels).toEqual({ value: "Визиты" });
  });

  it("passes a pie chart through without its link", () => {
    const pie: PieChartWidget = {
      kind: "pieChart",
      label: "Plans",
      query: async () => [],
      options: { category: "plan", value: "n", drilldown: "/x" },
    };
    expect(chartProps(pie, [], DEFAULT_LABELS)).toEqual({
      options: { category: "plan", value: "n" },
    });
  });
});

describe("chartProps with captions", () => {
  it("keeps caption options on the server", () => {
    const widget: BarChartWidget = {
      kind: "barChart",
      label: "Runs",
      query: async () => [],
      options: { x: "date", y: "value", coverage: "sample", freshness: { at: async () => null } },
    };
    expect(chartProps(widget, [], DEFAULT_LABELS).options).toEqual({ x: "date", y: "value" });
  });
});

describe("a chart of minor units", () => {
  it("draws the amount, and keeps access and minorUnits on the server", () => {
    const widget: BarChartWidget = {
      kind: "barChart",
      label: "New MRR",
      query: async () => [],
      options: { x: "month", format: "currency", minorUnits: 2, access: "admin" },
    };
    const rows = [{ month: "2026-09", mrr: 260000, plan: "pro" }];
    const { options } = chartProps(widget, rows, DEFAULT_LABELS);
    expect(options).toEqual({ x: "month", format: "currency", y: ["mrr"] });
    expect(chartRows(widget, rows, options)).toEqual([
      { month: "2026-09", mrr: 2600, plan: "pro" },
    ]);
  });
});
