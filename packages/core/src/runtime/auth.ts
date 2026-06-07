import { FlowpanelAccessError } from "../types/error.js";
import type { Session } from "../types/session.js";

export type RequireRole = string | string[] | ((s: Session | null) => boolean) | undefined;

export function checkRequireRole(
  required: RequireRole,
  role: string,
  session: Session | null,
): void {
  if (required === undefined) return;
  if (typeof required === "function") {
    if (!required(session)) throw new FlowpanelAccessError();
    return;
  }
  const allowed = Array.isArray(required) ? required : [required];
  if (!allowed.includes(role)) throw new FlowpanelAccessError();
}
