import { widgetSites } from "../../internal/widget-sites";
import { didYouMean } from "../../suggest";
import { FlowpanelConfigError } from "../../types/config-error";
import type { DashboardConfig } from "../../types/dashboard";
import type { RealtimeOption } from "../../types/realtime";
import type { ResourceConfig } from "../../types/resource";
import type { WidgetConfig } from "../../types/widget";

function widgetName(widget: WidgetConfig): string {
  const own = (widget as { label?: unknown }).label;
  const label = typeof own === "string" ? own : (widget.options as { label?: unknown }).label;
  return typeof label === "string" ? `the ${widget.kind} "${label}"` : `a ${widget.kind} widget`;
}

function check(value: RealtimeOption | undefined, where: string, known: readonly string[]): void {
  const targets: readonly unknown[] =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  for (const target of targets) {
    if (typeof target === "string") continue;
    const name = (target as { resource: string }).resource;
    if (known.includes(name)) continue;
    throw new FlowpanelConfigError(
      `${where} realtime`,
      `it subscribes to { resource: "${name}" }, which is not a registered resource.` +
        (didYouMean(name, known) || " Register the resource, or remove the target."),
    );
  }
}

/** Every `{ resource }` realtime target on a dashboard, record page or drawer is a registered resource. */
export function validateRealtime(
  resources: ReadonlyMap<string, ResourceConfig>,
  dashboards: readonly DashboardConfig[],
): void {
  const known = [...resources.keys()];
  for (const dashboard of dashboards)
    check(dashboard.realtime, `dashboard "${dashboard.path}"`, known);
  for (const { owner, place, resource, widget } of widgetSites(dashboards, resources)) {
    const on =
      place === "dashboard"
        ? `on ${owner}`
        : `on the "${resource}" ${place === "record" ? "record page" : "drawer"}`;
    const realtime = (widget.options as { realtime?: RealtimeOption } | undefined)?.realtime;
    check(realtime, `${widgetName(widget)} ${on}`, known);
  }
}
