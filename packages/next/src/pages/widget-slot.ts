import type { Span, WidgetConfig } from "@flowpanel/core";

const widgetSpanClass: Record<Span, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  6: "col-span-12 sm:col-span-6",
  8: "col-span-12 sm:col-span-8",
  12: "col-span-12",
};

export function widgetSpanClassName(widget: WidgetConfig): string | undefined {
  const span = widget.options.span;
  return span ? widgetSpanClass[span] : undefined;
}

/** A metric needs a flex grid item for a definite stretched height; other widgets keep their layout. */
export function widgetSlotClassName(widget: WidgetConfig): string | undefined {
  const span = widgetSpanClassName(widget);
  if (widget.kind !== "metric") return span;
  return span ? `flex ${span}` : "flex";
}
