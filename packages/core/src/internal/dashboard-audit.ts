/** The `resource` a dashboard action's audit event carries: dashboards are not resources. */
export const DASHBOARD_AUDIT_RESOURCE = "dashboard";

/** Every dashboard action's audit `action` starts with this. */
export const DASHBOARD_ACTION_PREFIX = "dashboard.action.";

/** The `action` and `resource` a run of the dashboard action `key` records. */
export function dashboardActionAudit(key: string): { action: string; resource: string } {
  return { action: `${DASHBOARD_ACTION_PREFIX}${key}`, resource: DASHBOARD_AUDIT_RESOURCE };
}

/** The dashboard action key an audit `action` names, or `null` for any other event. */
export function dashboardActionKey(action: string): string | null {
  return action.startsWith(DASHBOARD_ACTION_PREFIX)
    ? action.slice(DASHBOARD_ACTION_PREFIX.length)
    : null;
}
