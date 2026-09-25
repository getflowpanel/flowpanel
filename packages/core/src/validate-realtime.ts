import { didYouMean } from "./suggest";
import type { DashboardConfig } from "./types/dashboard";
import type { RealtimeOption } from "./types/realtime";
import type { ResourceConfig } from "./types/resource";

interface WidgetLike {
  kind: string;
  label?: unknown;
  options?: { label?: unknown; realtime?: RealtimeOption };
}

function isWidget(value: unknown): value is WidgetLike {
  return typeof value === "object" && value !== null && "kind" in value && "options" in value;
}

function detailWidgets(detail: unknown): WidgetLike[] {
  if (typeof detail !== "object" || detail === null) return [];
  const found: WidgetLike[] = [];
  for (const value of Object.values(detail)) {
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (isWidget(entry)) found.push(entry);
      const widgets = (entry as { widgets?: unknown } | null)?.widgets;
      if (Array.isArray(widgets)) found.push(...widgets.filter(isWidget));
    }
  }
  return found;
}

function widgetName(widget: WidgetLike): string {
  const label = typeof widget.label === "string" ? widget.label : widget.options?.label;
  return typeof label === "string" ? `the ${widget.kind} "${label}"` : `a ${widget.kind} widget`;
}

function check(value: RealtimeOption | undefined, where: string, known: readonly string[]): void {
  const targets: readonly unknown[] =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  for (const target of targets) {
    if (typeof target === "string") continue;
    const name = (target as { resource: string }).resource;
    if (known.includes(name)) continue;
    throw new Error(
      `flowpanel: ${where} subscribes to realtime { resource: "${name}" }, which is not a registered resource.${didYouMean(name, known)}`,
    );
  }
}

/** Every `{ resource }` realtime target on a dashboard, record page or drawer is a registered resource. */
export function validateRealtime(
  resources: ReadonlyMap<string, ResourceConfig>,
  dashboards: readonly DashboardConfig[],
): void {
  const known = [...resources.keys()];
  for (const dashboard of dashboards) {
    const at = `dashboard "${dashboard.path}"`;
    check(dashboard.realtime, at, known);
    for (const section of dashboard.sections) {
      for (const widget of section.widgets as unknown[]) {
        if (isWidget(widget))
          check(widget.options?.realtime, `${widgetName(widget)} on ${at}`, known);
      }
    }
  }
  for (const [name, resource] of resources) {
    for (const widget of detailWidgets(resource.options.detail)) {
      check(widget.options?.realtime, `${widgetName(widget)} on the "${name}" record page`, known);
    }
    for (const widget of detailWidgets(resource.options.drawer)) {
      check(widget.options?.realtime, `${widgetName(widget)} on the "${name}" drawer`, known);
    }
  }
}
