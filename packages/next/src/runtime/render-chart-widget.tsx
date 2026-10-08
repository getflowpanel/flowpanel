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
): Promise<ReactNode> {
  const { ChartRenderer } = await import("@flowpanel/charts");
  const data = await widget.query(ctx);
  const captionLine = await caption;
  const drilldown = resolveLink(config, ctx, widget.options.drilldown);
  const { options, seriesLabels } = chartProps(widget, data, ctx.labels);
  return (
    <ChartRenderer
      kind={widget.kind}
      label={widget.label}
      options={options}
      data={data}
      {...(seriesLabels ? { seriesLabels } : {})}
      {...(drilldown ? { drilldown } : {})}
      {...(captionLine ? { caption: captionLine } : {})}
    />
  );
}
