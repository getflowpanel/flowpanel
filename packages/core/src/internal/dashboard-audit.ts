/** The `resource` a dashboard action's audit event carries: dashboards are not resources. */
export const DASHBOARD_AUDIT_RESOURCE = "dashboard";

/** Every dashboard action's audit `action` starts with this. */
export const DASHBOARD_ACTION_PREFIX = "dashboard.action.";

/**
 * URL-safe encoding of a `DashboardConfig.path`. Underscores are escaped
 * before slashes so paths containing literal underscores round-trip.
 */
export function encodeDashboardPath(path: string): string {
  if (path === "/" || path === "") return "_root_";
  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  return trimmed.replace(/_/g, "_5f").replace(/\//g, "_2f");
}

/** Reverse of `encodeDashboardPath`. */
export function decodeDashboardPath(encoded: string): string {
  if (encoded === "_root_") return "/";
  return `/${encoded.replace(/_2f/g, "/").replace(/_5f/g, "_")}`;
}

/** The `action` and `resource` a run of the action `key` on the dashboard at `path` records. */
export function dashboardActionAudit(
  path: string,
  key: string,
): { action: string; resource: string } {
  return {
    action: `${DASHBOARD_ACTION_PREFIX}${encodeDashboardPath(path)}.${key}`,
    resource: DASHBOARD_AUDIT_RESOURCE,
  };
}
