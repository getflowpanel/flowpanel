import { widgetSites } from "../../internal/widget-sites";
import { didYouMean } from "../../suggest";
import { FlowpanelConfigError } from "../../types/config-error";
import type { DashboardConfig } from "../../types/dashboard";
import type { RealtimeConfig, RealtimeOption } from "../../types/realtime";
import type { ResourceConfig } from "../../types/resource";
import type { WidgetConfig } from "../../types/widget";

function widgetName(widget: WidgetConfig): string {
  const own = (widget as { label?: unknown }).label;
  const label = typeof own === "string" ? own : (widget.options as { label?: unknown }).label;
  return typeof label === "string" ? `the ${widget.kind} "${label}"` : `a ${widget.kind} widget`;
}

interface Known {
  resources: readonly string[];
  channels: readonly string[];
}

function checkChannel(channel: string, where: string, known: Known): void {
  if (channel.startsWith("resource.") || known.channels.includes(channel)) return;
  throw new FlowpanelConfigError(
    `${where} realtime`,
    `it subscribes to "${channel}", which realtime.channels does not declare.` +
      (didYouMean(channel, known.channels) ||
        ` Add realtime: { channels: { "${channel}": {} } }, with access if not every operator may see it.`),
  );
}

function check(value: RealtimeOption | undefined, where: string, known: Known): void {
  const targets: readonly unknown[] =
    value === undefined ? [] : Array.isArray(value) ? value : [value];
  for (const target of targets) {
    if (typeof target === "string") {
      checkChannel(target, where, known);
      continue;
    }
    const name = (target as { resource: string }).resource;
    if (known.resources.includes(name)) continue;
    throw new FlowpanelConfigError(
      `${where} realtime`,
      `it subscribes to { resource: "${name}" }, which is not a registered resource.` +
        (didYouMean(name, known.resources) || " Register the resource, or remove the target."),
    );
  }
}

/**
 * Every realtime target on a dashboard, list, record page or drawer is a registered resource or a
 * channel `realtime.channels` declares.
 */
export function validateRealtime(
  resources: ReadonlyMap<string, ResourceConfig>,
  dashboards: readonly DashboardConfig[],
  realtime: RealtimeConfig | undefined,
): void {
  const known: Known = {
    resources: [...resources.keys()],
    channels: Object.keys(realtime?.channels ?? {}),
  };
  for (const dashboard of dashboards)
    check(dashboard.realtime, `dashboard "${dashboard.path}"`, known);
  for (const [name, resource] of resources) {
    const list = resource.options.realtime;
    if (typeof list === "string") checkChannel(list, `resource "${name}"`, known);
  }
  for (const { owner, place, resource, widget } of widgetSites(dashboards, resources)) {
    const on =
      place === "dashboard"
        ? `on ${owner}`
        : `on the "${resource}" ${place === "record" ? "record page" : "drawer"}`;
    const realtime = (widget.options as { realtime?: RealtimeOption } | undefined)?.realtime;
    check(realtime, `${widgetName(widget)} ${on}`, known);
  }
}
