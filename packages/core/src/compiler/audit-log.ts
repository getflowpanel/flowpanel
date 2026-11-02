import type { Adapter } from "../types/adapter";
import type { AuditConfig, AuditLogStore } from "../types/audit";
import { FlowpanelConfigError } from "../types/config-error";

/** The store History tabs and the Audit log page read: on, no `sink`, and an adapter that has the table. */
export function resolveAuditLog(
  audit: AuditConfig | undefined,
  adapter: Pick<Adapter, "auditLog">,
): AuditLogStore | null {
  if (audit === undefined || audit.enabled === false || audit.sink) return null;
  if (adapter.auditLog) return adapter.auditLog;
  throw new FlowpanelConfigError(
    "audit",
    "it is on, but the adapter cannot write the flowpanel_audit_log table. " +
      "Pass audit.sink to send events to your own store.",
  );
}
