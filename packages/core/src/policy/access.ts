import { FlowpanelAccessError } from "../types/error";
import type { AccessContext, AccessRule, ResourceAccess, ResourceOperation } from "../types/policy";

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

/** Throws `FlowpanelAccessError` unless `rule` admits the caller. A missing rule denies. */
export async function requireAccess(rule: AccessRule, context: AccessContext): Promise<void> {
  if (rule === undefined || !(await accessAllows(rule, context))) throw new FlowpanelAccessError();
}

/** The rule a resource's `access` sets for one operation; `undefined` allows it. */
export function resolveOperationAccess<Row>(
  access: ResourceAccess<Row> | undefined,
  operation: ResourceOperation,
): AccessRule | undefined {
  if (!OPERATIONS.has(operation))
    throw new Error(`Unknown resource operation: ${String(operation)}`);
  return access?.[operation];
}

const OPERATIONS = new Set<unknown>(["read", "create", "update", "delete"]);
