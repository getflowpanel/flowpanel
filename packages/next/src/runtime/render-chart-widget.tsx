import type {
  AreaChartWidget,
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
  ResolvedAdminConfig,
  WidgetContext,
} from "@flowpanel/core";
import type { ReactNode } from "react";
import { chartProps } from "./chart-props";
import { resolveLink } from "./resolve-link";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";

type ChartWidget = AreaChartWidget | BarChartWidget | LineChartWidget | PieChartWidget;

/** A chart card: its rows, `y` filled from them, series named and the link resolved on the server. */
export async function renderChartWidget(
  widget: ChartWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  caption: CaptionPromise = NO_CAPTION,
): Promise<{ node: ReactNode; missing: boolean }> {
  let chartsMod: {
    // biome-ignore lint/suspicious/noExplicitAny: cross-package dynamic import
    ChartRenderer: (props: any) => ReactNode;
  };
  try {
    chartsMod =
      // biome-ignore lint/suspicious/noExplicitAny: dynamic import surface not typed
      (await import("@flowpanel/charts/runtime" as any)) as any;
  } catch (e) {
    console.error("[flowpanel/charts] dynamic import failed:", e);
    const node = (
      <div
        data-fp-error=""
        className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-4 text-xs text-fp-text-3"
      >
        {ctx.labels.widget.chartsMissing}
      </div>
    );
    return { node, missing: true };
  }
  const data = await widget.query(ctx);
  const captionLine = await caption;
  const drilldown = resolveLink(config, ctx, widget.options.drilldown);
  const { options, seriesLabels } = chartProps(widget, data, ctx.labels);
  const Renderer = chartsMod.ChartRenderer;
  const node = (
    <Renderer
      kind={widget.kind}
      label={widget.label}
      options={options}
      data={data}
      {...(seriesLabels ? { seriesLabels } : {})}
      {...(drilldown ? { drilldown } : {})}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
  return { node, missing: false };
}
