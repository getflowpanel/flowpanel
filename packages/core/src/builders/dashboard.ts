import type { DashboardConfig, PageConfig } from "../types/dashboard.js";

/** Register a dashboard route under `/admin<path>`. */
export function dashboard(config: DashboardConfig): DashboardConfig {
  return config;
}

/** Register an arbitrary page under `/admin<path>` that renders a custom React component. */
export function page(config: PageConfig): PageConfig {
  return config;
}
