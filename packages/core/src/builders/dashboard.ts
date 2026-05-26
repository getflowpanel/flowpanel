import type { DashboardConfig, PageConfig } from "../types/dashboard.js";

/**
 * Register a dashboard route under `/admin<path>`. Composes `sections` of
 * widgets (metric / table / chart / statGroup / custom) over an optional
 * `dateRange` filter.
 *
 * @example
 * ```ts
 * dashboard({
 *   path: "/",
 *   label: "Overview",
 *   dateRange: { preset: "last7d" },
 *   sections: [{
 *     columns: 3,
 *     widgets: [
 *       metric("Users", async ({ db }) => db.$count(schema.users)),
 *       table({ resource: "users", limit: 10 }),
 *     ],
 *   }],
 * })
 * ```
 */
export function dashboard(config: DashboardConfig): DashboardConfig {
  return config;
}

/**
 * Register an arbitrary page under `/admin<path>` that renders a custom React
 * component. Use when you need a route that isn't a CRUD list or a dashboard
 * — e.g. an analytics deep-dive, a custom report.
 *
 * @example
 * ```ts
 * page({
 *   path: "/reports/revenue",
 *   label: "Revenue",
 *   component: RevenueReport,
 * })
 * ```
 */
export function page(config: PageConfig): PageConfig {
  return config;
}
