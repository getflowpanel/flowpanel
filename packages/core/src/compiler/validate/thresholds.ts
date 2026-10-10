import { widgetSites } from "../../internal/widget-sites";
import { FlowpanelConfigError } from "../../types/config-error";
import type { DashboardConfig } from "../../types/dashboard";
import type { ResourceConfig } from "../../types/resource";
import type { Threshold } from "../../types/threshold";

const TONED_KINDS: ReadonlySet<string> = new Set(["metric", "stat", "bars", "tracker"]);

function check(where: string, t: Threshold, stated: unknown, whose: string): void {
  if (stated !== "up" && stated !== "down") return;
  if (t.warn === t.err) return;
  const read = t.warn < t.err ? "down" : "up";
  if (read === stated) return;
  const worse = read === "down" ? "higher" : "lower";
  throw new FlowpanelConfigError(
    `${where} tones`,
    `{ warn: ${t.warn}, err: ${t.err} } reads as ${worse} is worse, but ${whose} goodWhen is ` +
      `"${stated}". Swap warn and err, or set goodWhen: "${read}".`,
  );
}

function isThreshold(value: unknown): value is Threshold {
  const t = value as { warn?: unknown; err?: unknown } | null;
  return typeof t?.warn === "number" && typeof t.err === "number";
}

/** Throws at `defineAdmin` when a `goodWhen` contradicts the order of its threshold's numbers. */
export function validateThresholds(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): void {
  for (const [name, resource] of resourcesByName) {
    for (const [index, column] of (resource.options.columns ?? []).entries()) {
      const tones = (column as { format?: { tones?: unknown } } | null)?.format?.tones;
      if (!isThreshold(tones)) continue;
      check(`resource "${name}" columns[${index}].format`, tones, tones.goodWhen, "its");
    }
  }
  for (const { owner, site, widget } of widgetSites(dashboards, resourcesByName)) {
    if (widget.kind === "table") {
      for (const [index, column] of (widget.options.columns ?? []).entries()) {
        const tones = (column as { format?: { tones?: unknown } } | null)?.format?.tones;
        if (isThreshold(tones))
          check(`${owner} ${site}.columns[${index}]`, tones, tones.goodWhen, "its");
      }
    }
    if (!TONED_KINDS.has(widget.kind)) continue;
    const options = widget.options as { tones?: unknown; goodWhen?: unknown };
    if (!isThreshold(options.tones)) continue;
    const where = `${owner} ${site}`;
    check(where, options.tones, options.tones.goodWhen, "its");
    check(where, options.tones, options.goodWhen, "the card's");
  }
}
