import type { DashboardConfig, ResolvedAdminConfig } from "@flowpanel/core";

/** Resolve a dashboard for the given URL slug. */
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
