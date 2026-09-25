import type { DetailTab } from "../types/detail";
import type { ResourceConfig } from "../types/resource";
import type { WidgetConfig } from "../types/widget";

type Row = Record<string, unknown>;

/** Kinds that resolve per request with the page's URL and record; a drawer cannot show them. */
export const SERVER_RENDERED: ReadonlySet<string> = new Set([
  "timeline",
  "heatmap",
  "checklist",
  "tracker",
]);

function withTimelineIds(tab: DetailTab<Row>): DetailTab<Row> {
  let seen = 0;
  let changed = false;
  const widgets = tab.widgets?.map((widget): WidgetConfig => {
    if (widget.kind !== "timeline" || widget.options.id !== undefined) return widget;
    seen += 1;
    changed = true;
    return {
      ...widget,
      options: { ...widget.options, id: seen === 1 ? tab.key : `${tab.key}-${seen}` },
    };
  });
  return changed && widgets ? { ...tab, widgets } : tab;
}

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

/** Detail-tab timelines take the tab's key as their URL namespace; page-rendered kinds stay out of drawers. */
export function resolveDetailWidgets(name: string, resource: ResourceConfig): ResourceConfig {
  rejectInDrawer(name, resource);
  const tabs = resource.options.detail?.tabs as DetailTab<Row>[] | undefined;
  if (!tabs || tabs.length === 0) return resource;
  const resolved = tabs.map(withTimelineIds);
  if (resolved.every((tab, index) => tab === tabs[index])) return resource;
  return {
    ...resource,
    options: { ...resource.options, detail: { ...resource.options.detail, tabs: resolved } },
  };
}
