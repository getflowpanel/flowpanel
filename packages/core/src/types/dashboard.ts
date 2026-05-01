import type { WidgetConfig } from "./widget.js";

export type DateRangePreset = "today" | "yesterday" | "last7d" | "last30d" | "MTD" | "QTD" | "YTD";

export interface DateRangeConfig {
  preset?: DateRangePreset;
  default?: { from: Date; to: Date };
  /** Allow user to pick custom range in the date picker. */
  allowCustom?: boolean;
}

export interface ResolvedDateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset | "custom";
}

export interface SectionConfig {
  label?: string;
  description?: string;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  widgets: WidgetConfig[];
}

export interface DashboardConfig {
  path: string;
  label: string;
  icon?: string;
  dateRange?: DateRangeConfig;
  realtime?: string | string[];
  sections: SectionConfig[];
}

/** User-owned page, registered in nav but rendered by the user. */
export interface PageConfig {
  path: string;
  label: string;
  icon?: string;
  /** Path to app/admin/<slug> that the user will create. */
  href?: string;
}
