import type { ResourceConfig } from "@flowpanel/core";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";

/** The property naming a row of `resource`: `defineAdmin` resolves it to `rowKey` or the primary key. */
export function rowKeyOf(resource: ResourceConfig): string {
  return resource.options.rowKey ?? DEFAULT_RESOURCE_ROW_KEY;
}

/**
 * A row's identifier, or `null` when the projection carried none.
 * The literal string `"undefined"` is a valid identifier; an absent or non-scalar value is not.
 */
export function rowIdentity(row: Record<string, unknown>, rowKey: string): string | null {
  const raw = row[rowKey];
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "bigint") return String(raw);
  return null;
}
