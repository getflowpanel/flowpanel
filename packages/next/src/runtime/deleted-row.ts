import type { RequestContext, ResourceConfig } from "@flowpanel/core";
import { mayListDeleted } from "./list-rows";

/** The timestamp column `delete.softDelete` stamps, or null when deletes are permanent. */
export function softDeleteColumn(resource: ResourceConfig): string | null {
  const column = resource.options.delete?.softDelete;
  return column ? String(column) : null;
}

/** `select` plus the soft-delete column, so a read can tell a deleted row from a live one. */
export function withSoftDeleteColumn(
  resource: ResourceConfig,
  select: readonly string[],
): string[] {
  const column = softDeleteColumn(resource);
  return column && !select.includes(column) ? [...select, column] : [...select];
}

/** How a row opened by id shows: `live`, `deleted` to whoever could restore it, else `hidden` (not found). */
export async function rowVisibility(
  resource: ResourceConfig,
  row: Record<string, unknown>,
  reqCtx: RequestContext,
): Promise<"live" | "deleted" | "hidden"> {
  const column = softDeleteColumn(resource);
  if (column === null || row[column] === null || row[column] === undefined) return "live";
  return (await mayListDeleted(resource, reqCtx)) ? "deleted" : "hidden";
}
