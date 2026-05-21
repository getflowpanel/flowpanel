import type { ComponentType } from "react";
import type { DashboardAction } from "./action.js";
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
  /**
   * Optional top-bar action buttons rendered in the dashboard page header.
   * Triggered via `POST /api/flowpanel/dashboards/<encoded-path>/actions/<key>`.
   * See `DashboardAction` for the per-action shape.
   */
  actions?: DashboardAction[];
  /**
   * Hide the default `DashboardActionsBar`. Use when you render your own
   * action UI (e.g. via a `custom()` widget) but still want the action
   * endpoints generated from `actions: [...]`. The endpoints remain
   * mounted; only the header bar is suppressed.
   */
  hideActionsBar?: boolean;
}

/**
 * User page registered under `<basePath><path>` with a sidebar nav entry.
 *
 * Two flavours:
 * - **In-shell** (recommended) — pass `component`. FlowPanel mounts the
 *   component inside its admin shell at `<basePath><path>` via the existing
 *   catch-all route. The component may be a server or client component
 *   (with `"use client"`); standard RSC interop applies.
 * - **External** — pass `href`. The nav entry links to an arbitrary URL
 *   (typically a user-owned Next.js route at `app/admin/<slug>/page.tsx`)
 *   and FlowPanel does not render anything. Useful when the page needs
 *   chrome FlowPanel can't provide.
 *
 * Exactly one of `component` / `href` should be set; if both are present
 * `component` wins for in-shell rendering and `href` is ignored.
 */
export interface PageConfig {
  path: string;
  label: string;
  icon?: string;
  /** Server or client React component rendered at `<basePath><path>`. */
  component?: ComponentType<Record<string, never>>;
  /** External href used when `component` is not provided. */
  href?: string;
}
