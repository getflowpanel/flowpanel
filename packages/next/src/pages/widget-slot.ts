import type { SectionConfig, Span, WidgetConfig } from "@flowpanel/core";
import { warnOnce } from "../runtime/widget-reads";

const widgetSpanClass: Record<Span, string> = {
  1: "col-span-12 sm:col-span-1",
  2: "col-span-12 sm:col-span-2",
  3: "col-span-12 sm:col-span-3",
  4: "col-span-12 sm:col-span-4",
  5: "col-span-12 sm:col-span-5",
  6: "col-span-12 sm:col-span-6",
  7: "col-span-12 sm:col-span-7",
  8: "col-span-12 sm:col-span-8",
  9: "col-span-12 sm:col-span-9",
  10: "col-span-12 sm:col-span-10",
  11: "col-span-12 sm:col-span-11",
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

/** Whether a strip draws `widget` as a plain cell; another kind warns once and keeps its card. */
export function stripWidget(widget: WidgetConfig, where: string, section: number): boolean {
  if (widget.kind === "metric" || widget.kind === "stat") return true;
  warnOnce(
    `strip:${where}:${section}:${widget.kind}`,
    `${where} section ${section} is a strip, which draws metric and stat widgets; ` +
      `a ${widget.kind} widget renders as its own card there.`,
  );
  return false;
}

/** A grid's columns: as declared, else 12 when any widget sets `span`, else `fallback`. */
export function sectionColumns(
  columns: SectionConfig["columns"],
  widgets: readonly WidgetConfig[],
  fallback: 1 | 2,
): NonNullable<SectionConfig["columns"]> {
  if (columns !== undefined) return columns;
  return widgets.some((widget) => widget.options.span !== undefined) ? 12 : fallback;
}
