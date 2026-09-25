import type { ComponentType } from "react";
import type { DashboardAction } from "./action";
import type { IconName } from "./icon";
import type { Session } from "./session";
import type { WidgetConfig } from "./widget";

export type DateRangePreset = "today" | "yesterday" | "last7d" | "last30d" | "MTD" | "QTD" | "YTD";

/**
 * The sidebar group an entry joins: its label, or `{ label, collapsed: true }` for a
 * group that folds under its label until it holds the current page.
 */
export type NavGroupRef = string | { label: string; collapsed?: boolean };

/** Date picker offered above a dashboard. */
export interface DateRangeConfig {
  /** Range selected on first load. */
  preset?: DateRangePreset;
  /** Explicit range used when no preset is given. */
  default?: { from: Date; to: Date };
  /**
   * Presets the picker offers, in order. A URL preset outside the list is ignored,
   * and `preset` defaults to the first entry. Default: all seven.
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
   * `"strip"` draws the section's `metric` and `stat` widgets as one band divided by hairlines,
   * with no card around each; another kind renders as its own card and warns in development.
   * `columns` is the cells per line from `md` up.
   * @defaultValue "cards"
   */
  variant?: "cards" | "strip";
  widgets: WidgetConfig[];
}

export interface DashboardConfig {
  /** Path under `basePath`. `"/"` makes this the admin's landing page. */
  path: string;
  /** Nav entry and page title. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Sidebar group for this entry. Default: the kind's own group — Dashboards or Pages. */
  navGroup?: NavGroupRef;
  /** Adds a date picker whose value reaches every widget query. */
  dateRange?: DateRangeConfig;
  /** SSE channel(s) the whole dashboard subscribes to, independent of any widget. */
  realtime?: string | string[];
  /**
   * Re-render the whole dashboard on an interval, e.g. `"60s"` or `"5m"`, and
   * show how old the numbers are next to the date picker. Paused while the tab
   * is hidden.
   */
  refresh?: `${number}s` | `${number}m`;
  /** Widget bands, rendered top to bottom. */
  sections: SectionConfig[];
  /** Optional top-bar action buttons rendered in the dashboard page header. */
  // biome-ignore lint/suspicious/noExplicitAny: a dashboard stores heterogeneous action payloads; each payload remains exact on dashboardAction().
  actions?: DashboardAction<any, any>[];
  /** Hide the default `DashboardActionsBar`. */
  hideActionsBar?: boolean;
  /** Restrict access to this dashboard. */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
}

/** User page registered under `<basePath><path>` with a sidebar nav entry. */
export interface PageConfig {
  /** Path under `basePath`. */
  path: string;
  /** Nav entry and page title. */
  label: string;
  /** Serializable Lucide icon rendered in navigation and the command palette. */
  icon?: IconName;
  /** Sidebar group for this entry. Default: the kind's own group — Dashboards or Pages. */
  navGroup?: NavGroupRef;
  /** Server or client React component rendered at `<basePath><path>`. */
  component?: ComponentType<Record<string, never>>;
  /** External href used when `component` is not provided. */
  href?: string;
  /** Restrict access to this page. */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
}
