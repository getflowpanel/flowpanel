import type { AuditConfig, AuditEvent } from "@flowpanel/core";

export async function emitAudit(cfg: AuditConfig | undefined, event: AuditEvent): Promise<void> {
  if (!cfg) return;
  if (cfg.enabled === false) return;
  if (!cfg.sink) return;
  try {
    await cfg.sink(event);
  } catch (err) {
    // A hole in the audit trail matters most in production — never swallow this silently.
    console.error("[flowpanel] audit sink error:", err);
  }
}
