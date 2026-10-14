import type { ComponentType } from "react";
import type { EnumDef } from "../builders/enum-of";
import type { DashboardAction } from "./action";
import type { IconName } from "./icon";
import type { AccessRule } from "./policy";
import type { RealtimeOption } from "./realtime";
import type { SelectOption } from "./resource";
import type { WidgetConfig } from "./widget";
import type { WidgetContext } from "./widget-context";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last7d"
  | "last30d"
  | "last12m"
  | "MTD"
  | "QTD"
  | "YTD";

/**
 * The sidebar group an entry joins: its label, or `{ label, collapsed: true }` for a
 * group that folds under its label until it holds the current page.
 */
export type NavGroupRef = string | { label: string; collapsed?: boolean };

/** Date picker offered above a dashboard. */
export interface DateRangeConfig {
  /** Range selected on first load; one outside `presets` is dropped with a development warning. */
  preset?: DateRangePreset;
  /** Explicit range used when no preset is given. */
  default?: { from: Date; to: Date };
  /**
   * Presets the picker offers, in order. A URL preset outside the list is ignored, and
   * without `preset` or `default` the first entry is selected. Default: all seven.
   */
  presets?: DateRangePreset[];
}

/** The active range, as every widget query receives it. */
export interface ResolvedDateRange {
  from: Date;
  to: Date;
  /** `"custom"` once the operator picks their own dates. */
  preset: DateRangePreset | "custom";
}

/** The range a widget query receives: the picked range, the one it is compared with, and the zone. */
export interface WidgetDateRange extends ResolvedDateRange {
  /**
   * The period compared against: the same stretch a day, month, quarter or year back for a
   * calendar preset, else the span before it. `null` when there is no earlier period to query.
   */
  previous: { from: Date; to: Date } | null;
  /** IANA zone the admin renders and buckets in — `formatting.timeZone`, else `"UTC"`. */
  timeZone: string;
}

/** A titled band of widgets on a dashboard. */
export interface SectionConfig {
  /** Section heading. Omit for an untitled band. */
  label?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Grid columns the widgets lay out across; omitted, 12 when a widget sets `span`.
   * @defaultValue 1
   */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  /**
   * `"strip"` draws the section's `metric`/`stat` widgets as one band with no card; another kind warns in development.
   * @defaultValue "cards"
   */
  variant?: "cards" | "strip";
  /**
   * How cards in one row size: `"stretch"` to the tallest, `"start"` each to its content.
   * Default: a `table` or `list` keeps its own height, every other card stretches.
   */
  align?: "stretch" | "start";
  widgets: WidgetConfig[];
}

/** A select above a dashboard that narrows every widget, read as `ctx.filters[key]`. */
export interface DashboardFilter {
  /** The URL key `f_<key>`, as a list's filters use, and the key in `ctx.filters`. */
  key: string;
  /** The select's label. */
  label: string;
  /** The choices: a list, an `enumOf()`, or a function of the context. */
  options: SelectOption[] | EnumDef | ((ctx: WidgetContext) => Promise<SelectOption[]>);
}

export interface DashboardConfig {
  /** Path under `paths.admin`. `"/"` makes this the admin's landing page. */
  path: string;
  /** Nav entry and page title. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Sidebar group for this entry. Default: the kind's own group — Dashboards or Pages. */
  navGroup?: NavGroupRef;
  /** Adds a date picker whose value reaches every widget query. */
  dateRange?: DateRangeConfig;
  /** Selects beside the date picker; the values reach every widget as `ctx.filters`. */
  filters?: DashboardFilter[];
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
  /** Re-renders the whole dashboard on an interval, e.g. `"60s"` or `"5m"`; paused while the tab is hidden. */
  refresh?: `${number}s` | `${number}m`;
  /** Widget bands, rendered top to bottom. */
  sections: SectionConfig[];
  /** Optional top-bar action buttons rendered in the dashboard page header. */
  // biome-ignore lint/suspicious/noExplicitAny: a dashboard stores heterogeneous action payloads; each payload remains exact on dashboardAction().
  actions?: DashboardAction<any, any>[];
  /** Hide the default `DashboardActionsBar`. */
  hideActionsBar?: boolean;
  /** Who may see and open this dashboard and run its actions. */
  access?: AccessRule;
}

/** User page registered under `<paths.admin><path>` with a sidebar nav entry. */
export interface PageConfig {
  /** Path under `paths.admin`. */
  path: string;
  /** Nav entry and page title. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Sidebar group for this entry. Default: the kind's own group — Dashboards or Pages. */
  navGroup?: NavGroupRef;
  /** Server or client React component rendered at `<paths.admin><path>`. */
  component?: ComponentType<Record<string, never>>;
  /** External href used when `component` is not provided. */
  href?: string;
  /** Who may see and open this page. */
  access?: AccessRule;
}
