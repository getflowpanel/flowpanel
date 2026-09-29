import type { ResourceConfig } from "../types/resource";
import type { WidgetConfig } from "../types/widget";
import { withRecordTimelineIds } from "./timeline-ids";

/** Kinds that resolve per request with the page's URL and record; a drawer cannot show them. */
export const SERVER_RENDERED: ReadonlySet<string> = new Set([
  "timeline",
  "heatmap",
  "checklist",
  "tracker",
]);

function rejectInDrawer(name: string, resource: ResourceConfig): void {
  (resource.options.drawer?.tabs ?? []).forEach((tab, t) => {
    if (!("widgets" in tab)) return;
    (tab.widgets as WidgetConfig[]).forEach((widget, w) => {
      if (!SERVER_RENDERED.has(widget.kind)) return;
      throw new Error(
        `flowpanel: resource "${name}" drawer.tabs[${t}].widgets[${w}] is a ${widget.kind}, ` +
          "which renders only on a page; put it in a detail tab (detail.tabs[].widgets).",
      );
    });
  });
}

/** Every timeline on a record page gets its own URL namespace; page-rendered kinds stay out of drawers. */
export function resolveDetailWidgets(name: string, resource: ResourceConfig): ResourceConfig {
  rejectInDrawer(name, resource);
  return withRecordTimelineIds(name, resource);
}
