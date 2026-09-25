import type {
  AreaChartWidget,
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
  ResolvedLabels,
} from "@flowpanel/core";
import { keyLabel, OTHER_KEY } from "@flowpanel/core";

type ChartWidget = AreaChartWidget | BarChartWidget | LineChartWidget | PieChartWidget;

export interface ChartProps {
  options: Record<string, unknown>;
  seriesLabels?: Record<string, string>;
}

function isNumericValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "bigint") return true;
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
}

function inferredY(x: string, data: readonly unknown[]): string[] {
  const first = data[0];
  if (typeof first !== "object" || first === null) return [];
  const row = first as Record<string, unknown>;
  return Object.keys(row).filter((key) => key !== x && isNumericValue(row[key]));
}

/** What a chart renderer receives: `y` filled from the data, series named in plain text, no link. */
export function chartProps(
  widget: ChartWidget,
  data: readonly unknown[],
  labels: ResolvedLabels,
): ChartProps {
  if (widget.kind === "pieChart") {
    const {
      drilldown: _drilldown,
      freshness: _freshness,
      coverage: _coverage,
      ...options
    } = widget.options;
    return { options };
  }
  const {
    drilldown: _drilldown,
    labels: names,
    freshness: _freshness,
    coverage: _coverage,
    ...options
  } = widget.options;
  const y = options.y ?? inferredY(options.x, data);
  const keys = typeof y === "string" ? [y] : y;
  const seriesLabels = Object.fromEntries(
    keys.map((key) => {
      const named = keyLabel(names, key);
      return [key, key === OTHER_KEY && named === OTHER_KEY ? labels.widget.other : named];
    }),
  );
  return { options: { ...options, y }, seriesLabels };
}
