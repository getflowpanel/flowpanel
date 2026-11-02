import type { DashboardConfig, PageConfig } from "../types/dashboard";

/** Register a dashboard route under `/admin<path>`. */
export function dashboard(config: DashboardConfig): DashboardConfig {
  return config;
}

/** A custom page under `/admin<path>` that renders your React component; list it in `pages: [...]`. */
export function page(config: PageConfig): PageConfig & { kind: "page" } {
  return { ...config, kind: "page" };
}
