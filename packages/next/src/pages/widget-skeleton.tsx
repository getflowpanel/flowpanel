import type { WidgetConfig } from "@flowpanel/core";
import { chartBox } from "@flowpanel/core/internal";
import { Card, Skeleton, SkeletonCard } from "@flowpanel/react";
import type { ReactNode } from "react";

const CARD_CHROME = 92;

type ChartWidget = Extract<WidgetConfig, { kind: `${string}Chart` }>;

/** The height in px a widget's placeholder holds, close to what the widget draws, so the page does not jump when it arrives. */
export function widgetSkeletonHeight(widget: Exclude<WidgetConfig, ChartWidget>): number {
  switch (widget.kind) {
    case "metric":
      return widget.options.compare || widget.options.sparkline ? 136 : 116;
    case "stat":
      return 116;
    case "table": {
      // A new app's table holds few rows; reserving all of `limit` would pull the page up on arrival.
      const rows = Math.min(widget.options.limit ?? 10, 5);
      return CARD_CHROME + rows * (widget.options.density === "compact" ? 40 : 53);
    }
    case "custom":
      return widget.options.minHeight ?? 80;
    default:
      return 232;
  }
}

/** A chart card's placeholder: its heading lines, then the chart's own box. */
function chartSkeleton(widget: ChartWidget): ReactNode {
  const captioned = widget.options.freshness !== undefined || widget.options.coverage !== undefined;
  return (
    <Card className="fp-w-full">
      {widget.label || captioned ? (
        <div className="fp-px-4 fp-pt-4 fp-pb-2">
          <Skeleton className="fp-h-5 fp-w-32" />
          {captioned ? <Skeleton className="fp-mt-0.5 fp-h-4 fp-w-24" /> : null}
        </div>
      ) : null}
      <div className="fp-p-3">
        <div
          className="fp-animate-pulse fp-rounded fp-bg-canvas"
          style={chartBox(widget.options.height)}
        />
      </div>
    </Card>
  );
}

/** A widget's placeholder: a chart card with the chart's own box, else a card of the widget's height. */
export function widgetSkeleton(widget: WidgetConfig): ReactNode {
  switch (widget.kind) {
    case "areaChart":
    case "barChart":
    case "lineChart":
    case "pieChart":
      return chartSkeleton(widget);
    default:
      return <SkeletonCard height={widgetSkeletonHeight(widget)} />;
  }
}
