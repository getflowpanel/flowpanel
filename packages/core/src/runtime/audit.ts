import type { AuditConfig, AuditEvent, AuditLogStore } from "@flowpanel/core";
import { loggableError } from "./describe-error";

interface AuditTarget {
  audit?: AuditConfig | undefined;
  auditLog?: AuditLogStore | null | undefined;
}

function auditOn(audit: AuditConfig | undefined): audit is AuditConfig {
  return audit !== undefined && audit.enabled !== false;
}

/** Whether a write on a resource with this `audit` option records an event. */
export function isAuditActive(config: AuditTarget, resourceAudit?: boolean): boolean {
  if (resourceAudit === false || !auditOn(config.audit)) return false;
  return Boolean(config.audit.sink ?? config.auditLog);
}

/** Records one event through the admin's `sink` or its audit table; a failure is logged, never thrown. */
export async function emitAudit(config: AuditTarget, event: AuditEvent): Promise<void> {
  if (!auditOn(config.audit)) return;
  const store = config.auditLog;
  const write = config.audit.sink ?? (store ? (e: AuditEvent) => store.append(e) : undefined);
  if (!write) return;
  try {
    await write(event);
  } catch (err) {
    console.error("[flowpanel] audit write failed:", loggableError(err));
  }
}
