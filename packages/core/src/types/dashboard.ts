import type { ComponentType } from "react";
import type { z } from "zod";
import type { DashboardAction } from "./action.js";
import type { Session } from "./session.js";
import type { WidgetConfig } from "./widget.js";

export type DateRangePreset = "today" | "yesterday" | "last7d" | "last30d" | "MTD" | "QTD" | "YTD";

/**
 * Declaration of a single URL search param a dashboard reads. Pairs a Zod
 * schema (validating the *raw string* value from the query string) with a
 * fallback applied when the param is absent or fails validation.
 *
 * The schema MUST accept a string input — use `z.coerce.number()`,
 * `z.enum([...])`, etc. The client hook `useDashboardParam` and any
 * server-side param parsing both validate against this schema, so a single
 * declaration drives both ends.
 *
 * @example
 * urlParams: {
 *   range: { schema: z.enum(["24h", "7d", "30d"]), default: "24h" },
 *   page:  { schema: z.coerce.number().int().min(1), default: 1 },
 * }
 */
export interface UrlParamSpec<T = unknown> {
  /** Zod schema validating the raw string value pulled from the query string. */
  schema: z.ZodType<T>;
  /** Value used when the param is missing or fails validation. */
  default: T;
}

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
  /**
   * Declared URL search params this dashboard reads, keyed by param name.
   * Optional: a dashboard that doesn't declare any still works (widgets
   * read `req.url` directly). Declaring them unlocks type-safe
   * `useDashboardParam(key, schema, fallback)` on the client — the schema
   * and fallback live in one place instead of being re-typed at each call
   * site. See `UrlParamSpec`.
   */
  urlParams?: Record<string, UrlParamSpec>;
  /**
   * Restrict access to this dashboard. Enforced (via `checkRequireRole`)
   * before the dashboard renders. Mirrors `ResourceConfig`/`QueueConfig`:
   * a single role, a list (any match passes), or a predicate over the
   * session. Throws `FlowpanelAccessError` (→ 403) when the viewer fails.
   */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
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
  /**
   * Restrict access to this page. Enforced (via `checkRequireRole`) before
   * the page renders. Mirrors `ResourceConfig`/`QueueConfig`: a single role,
   * a list (any match passes), or a predicate over the session. Throws
   * `FlowpanelAccessError` (→ 403) when the viewer fails.
   */
  requireRole?: string | string[] | ((session: Session | null) => boolean);
}
