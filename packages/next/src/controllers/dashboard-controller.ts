import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { createDashboardActionController } from "./action-controller.js";

/** Protected dashboard operations. Widget view-model queries stay server-rendered in 0.2. */
export function createDashboardController(
  config: ResolvedAdminConfig,
  context: RequestContext,
  path: string,
) {
  if (!config.dashboardsByPath.has(path)) {
    throw new Error(`Unknown Flowpanel dashboard: ${path}`);
  }
  return createDashboardActionController(config, context, path);
}
