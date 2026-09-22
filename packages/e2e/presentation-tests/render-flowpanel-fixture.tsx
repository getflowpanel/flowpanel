import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WidgetConfig } from "../../core/src/types/widget";
import { widgetSlotClassName } from "../../next/src/pages/widget-slot";
import { DefaultMetricCard } from "../../react/dist/index.mjs";

const legacy = process.argv.includes("--legacy");
const nonMetrics = process.argv.includes("--non-metrics");

function widget(label: string, value: number): string {
  const metric: WidgetConfig = {
    kind: "metric",
    label,
    query: async () => value,
    options: {},
  };
  const slot = widgetSlotClassName(metric) ?? "";
  const markup = renderToStaticMarkup(
    createElement(DefaultMetricCard, {
      label,
      value,
      drilldown: label === "A" ? "#metric-a" : undefined,
      ...(label === "B" ? { sublabel: "Compared with last month" } : {}),
      ...(label === "C" ? { delta: { value: 0.123, vs: "last month" } } : {}),
    }),
  );
  return `<div class="${legacy ? slot.replace("h-full", "") : slot}">${legacy ? markup.replaceAll("h-full", "") : markup}</div>`;
}

function slot(widget: WidgetConfig, id: string, content: string): string {
  const className = widgetSlotClassName(widget);
  return `<div id="${id}"${className ? ` class="${className}"` : ""}>${content}</div>`;
}

function nonMetricWidgets(): string {
  const table: WidgetConfig = { kind: "table", options: {} };
  const chart: WidgetConfig = {
    kind: "areaChart",
    label: "Chart",
    query: async () => [],
    options: { x: "x", y: "y" },
  } as never;
  const custom: WidgetConfig = {
    kind: "custom",
    Component: () => null,
    props: {},
    options: { frame: false },
  };
  return [
    slot(table, "table-slot", '<div data-non-metric="table">Table</div>'),
    slot(chart, "chart-slot", '<div data-non-metric="chart">Chart</div>'),
    slot(
      custom,
      "custom-slot",
      '<div id="custom-first">Custom first</div><div id="custom-second">Custom second</div>',
    ),
  ].join("");
}

process.stdout.write(
  nonMetrics ? nonMetricWidgets() : `${widget("A", 1)}${widget("B", 1234)}${widget("C", 1234567)}`,
);
