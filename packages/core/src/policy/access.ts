import type { RequireRole } from "../runtime/auth.js";
import { FlowpanelAccessError } from "../types/error.js";
import type {
  AccessContext,
  AccessRule,
  ResourceAccess,
  ResourceOperation,
} from "../types/policy.js";

export async function accessAllows(
  rule: AccessRule | undefined,
  context: AccessContext,
): Promise<boolean> {
  if (rule === undefined || rule === true) return true;
  if (rule === false) return false;
  if (typeof rule === "function") return Boolean(await rule(context));
  const roles = Array.isArray(rule) ? rule : [rule];
  return roles.includes(context.role);
}

export async function authorizeOperation(
  rule: AccessRule | undefined,
  context: AccessContext,
): Promise<void> {
  if (!(await accessAllows(rule, context))) throw new FlowpanelAccessError();
}

/** Resolve the canonical rule while keeping `requireRole` as a 0.2 compatibility alias. */
export function resolveOperationAccess<Row>(
  access: ResourceAccess<Row> | undefined,
  requireRole: RequireRole,
  operation: ResourceOperation,
): AccessRule | undefined {
  if (access !== undefined && requireRole !== undefined) {
    throw new Error(
      "A resource cannot declare both access and requireRole. Move the role rule into access.",
    );
  }
  if (access !== undefined) return access[operation];
  if (typeof requireRole === "function") {
    return ({ session }) => requireRole(session);
  }
  return requireRole;
}
