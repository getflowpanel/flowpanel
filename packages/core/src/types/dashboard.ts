import type { ComponentType } from "react";
import type { DashboardAction } from "./action.js";
import type { Session } from "./session.js";
import type { WidgetConfig } from "./widget.js";

export type DateRangePreset = "today" | "yesterday" | "last7d" | "last30d" | "MTD" | "QTD" | "YTD";

/** Date picker offered above a dashboard. */
export interface DateRangeConfig {
  /** Range selected on first load. */
  preset?: DateRangePreset;
  /** Explicit range used when no preset is given. */
  default?: { from: Date; to: Date };
}

/** The active range, as every widget query receives it. */
export interface ResolvedDateRange {
  from: Date;
  to: Date;
  /** `"custom"` once the operator picks their own dates. */
  preset: DateRangePreset | "custom";
}

/** A titled band of widgets on a dashboard. */
export interface SectionConfig {
  /** Section heading. Omit for an untitled band. */
  label?: string;
  /** Supporting copy under the heading. */
  description?: string;
  /** Grid columns the widgets lay out across. Defaults to 12. */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  widgets: WidgetConfig[];
}

export interface DashboardConfig {
  /** Path under `basePath`. `"/"` makes this the admin's landing page. */
  path: string;
  /** Nav entry and page title. */
  label: string;
  /** Adds a date picker whose value reaches every widget query. */
  dateRange?: DateRangeConfig;
  /** SSE channel(s) the whole dashboard subscribes to, independent of any widget. */
  realtime?: string | string[];
  /** Widget bands, rendered top to bottom. */
  sections: SectionConfig[];
  /** Optional top-bar action buttons rendered in the dashboard page header. */
  actions?: DashboardAction[];
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
  /** Server or client React component rendered at `<basePath><path>`. */
  component?: ComponentType<Record<string, never>>;
  /** External href used when `component` is not provided. */
  href?: string;
  /** Restrict access to this page. */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
}
