import type { DashboardConfig, ResolvedAdminConfig } from "@flowpanel/core";

/**
 * Resolve a dashboard for the given URL slug.
 *
 * - Empty slug ([]) picks the dashboard at path "/", or else the first
 *   dashboard in `config.dashboards` if present.
 * - Non-empty slug matches against `dashboardsByPath` using the
 *   "/" + slug.join("/") convention.
 */
export function matchDashboard(
  slug: string[],
  config: ResolvedAdminConfig,
): DashboardConfig | null {
  if (slug.length === 0) {
    const root = config.dashboardsByPath.get("/");
    if (root) return root;
    const first = config.dashboards?.[0];
    if (first) return first;
    return null;
  }
  const path = `/${slug.join("/")}`;
  return config.dashboardsByPath.get(path) ?? null;
}
