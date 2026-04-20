/**
 * Evaluator: runs widget data-loaders server-side and returns structured data
 * safe to send over the wire.
 */

import type {
  ChartWidgetData,
  CustomWidgetData,
  DashboardData,
  ListWidgetData,
  MetricWidgetData,
  ResolvedWidget,
  WidgetData,
} from "./types";

export async function evaluateWidget(widget: ResolvedWidget, ctx: unknown): Promise<WidgetData> {
  try {
    switch (widget.type) {
      case "metric": {
        const [value, trend, sublabel] = await Promise.all([
          widget.value(ctx),
          widget.trend ? widget.trend(ctx) : Promise.resolve(null),
          typeof widget.sublabel === "function"
            ? widget.sublabel(ctx)
            : Promise.resolve(widget.sublabel ?? null),
        ]);
        const data: MetricWidgetData = { type: "metric", value, trend, sublabel };
        return data;
      }
      case "list": {
        const rows = await widget.rows(ctx);
        const limit = widget.limit ?? 10;
        const items = rows.slice(0, limit).map((r) => widget.render(r));
        const data: ListWidgetData = { type: "list", items };
        return data;
      }
      case "chart": {
        const buckets = await widget.data(ctx);
        const data: ChartWidgetData = { type: "chart", buckets };
        return data;
      }
      case "custom": {
        const payload = widget.data ? await widget.data(ctx) : null;
        const data: CustomWidgetData = { type: "custom", data: payload };
        return data;
      }
    }
  } catch (err) {
    return { type: "error", error: (err as Error).message ?? String(err) };
  }
}

export async function evaluateDashboard(
  widgets: ResolvedWidget[],
  ctx: unknown,
  widgetIds?: string[],
): Promise<DashboardData> {
  const filtered = widgetIds ? widgets.filter((w) => widgetIds.includes(w.id)) : widgets;
  const results: Record<string, WidgetData> = {};
  await Promise.all(
    filtered.map(async (w) => {
      results[w.id] = await evaluateWidget(w, ctx);
    }),
  );
  return { widgets: results };
}
