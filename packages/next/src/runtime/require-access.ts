import type { AccessContext, AccessRule } from "@flowpanel/core";
import { requireAccess } from "@flowpanel/core";

/** The gate for an optional `access` option: left unset, it allows. */
export async function requireAccessIfSet(
  rule: AccessRule | undefined,
  context: AccessContext,
): Promise<void> {
  if (rule !== undefined) await requireAccess(rule, context);
}
