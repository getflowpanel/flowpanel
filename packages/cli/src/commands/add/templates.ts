/**
 * Widget templates copied by `flowpanel add <name>`. Each template is a
 * self-contained React component the user edits freely.
 *
 * Source of each template lives alongside as a `.tpl` file (real TSX you
 * can open in the editor — IDE syntax assoc works by prefixing the name
 * with the component name). esbuild's `text` loader inlines each file as
 * a string at build time, so there's no runtime `fs` lookup and no need
 * to copy templates into the npm tarball separately.
 *
 * Adding a template:
 *   1. Drop `templates/NewOne.tpl` next to the existing ones.
 *   2. Add an entry below — filename, exportName, source import.
 */

import kvSource from "./templates/KV.tpl";
import sparklineSource from "./templates/Sparkline.tpl";
import statCardSource from "./templates/StatCard.tpl";
import statusBannerSource from "./templates/StatusBanner.tpl";
import timelineSource from "./templates/Timeline.tpl";

export interface WidgetTemplate {
  filename: string;
  exportName: string;
  /** Raw TSX source. `__NAME__` is substituted with the requested name. */
  source: string;
}

export const WIDGETS: Record<string, WidgetTemplate> = {
  "stat-card": {
    filename: "StatCard.tsx",
    exportName: "StatCard",
    source: statCardSource,
  },
  timeline: {
    filename: "Timeline.tsx",
    exportName: "Timeline",
    source: timelineSource,
  },
  kv: {
    filename: "KV.tsx",
    exportName: "KV",
    source: kvSource,
  },
  "status-banner": {
    filename: "StatusBanner.tsx",
    exportName: "StatusBanner",
    source: statusBannerSource,
  },
  sparkline: {
    filename: "Sparkline.tsx",
    exportName: "Sparkline",
    source: sparklineSource,
  },
};

export function renderWidgetTemplate(name: string, template: WidgetTemplate): string {
  return template.source.replaceAll("__NAME__", name);
}
