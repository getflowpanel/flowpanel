import type { AuditConfig, AuditEvent } from "../types/config.js";

export async function emitAudit(cfg: AuditConfig | undefined, event: AuditEvent): Promise<void> {
  if (!cfg) return;
  if (cfg.enabled === false) return;
  if (!cfg.sink) return;
  try {
    await cfg.sink(event);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[flowpanel] audit sink error:", err);
    }
  }
}
