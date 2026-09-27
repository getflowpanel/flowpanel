import type { SectionConfig, Span, WidgetConfig } from "@flowpanel/core";

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

const OWN_HEIGHT = new Set<WidgetConfig["kind"]>(["table", "list"]);

/**
 * A metric needs a flex grid item for a definite stretched height. A table or a list keeps its
 * own height unless the section says `align: "stretch"`; `align: "start"` does that for all.
 */
export function widgetSlotClassName(
  widget: WidgetConfig,
  align?: SectionConfig["align"],
): string | undefined {
  const start = align === "start" || (align === undefined && OWN_HEIGHT.has(widget.kind));
  const classes = [
    widget.kind === "metric" ? "flex" : undefined,
    widgetSpanClassName(widget),
    start ? "self-start" : undefined,
  ].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
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
