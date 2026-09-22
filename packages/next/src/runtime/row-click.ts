import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { buildHref } from "./href";
import { rowIdentity } from "./row-identity";

/** What a row click does, with the resource's defaults already applied. */
export type RowClickMode = "detail" | "drawer" | false;

/**
 * Resolve `ResourceOptions.rowClick`. A declared value wins; `"drawer"` still
 * needs a drawer to open. Without one, a resource that configured a detail page
 * opens it, a resource that configured only a drawer opens that, and a resource
 * that configured neither leaves its rows inert.
 */
export function resolveRowClick(resource: ResourceConfig): RowClickMode {
  const hasDrawer = !!resource.options.drawer;
  const declared = resource.options.rowClick;
  if (declared !== undefined) {
    if (declared === "drawer") return hasDrawer ? "drawer" : false;
    return declared;
  }
  if (resource.options.detail && !hasDrawer) return "detail";
  return hasDrawer ? "drawer" : false;
}

/** Per-row detail URLs, indexed like `rows`. A row with no identity gets `null`. */
export function detailRowHrefs(
  config: ResolvedAdminConfig,
  name: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  rowKey: string,
): (string | null)[] {
  return rows.map((row) => {
    const id = rowIdentity(row, rowKey);
    return id === null ? null : buildHref(config, name, id);
  });
}
