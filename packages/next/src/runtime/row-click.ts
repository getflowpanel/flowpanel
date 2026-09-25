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

/** The record page a drawer row opens over: its path, its query and the tab holding the row. */
export interface CardPlace {
  path: string;
  params: URLSearchParams;
  tab: string;
}

function drawerHref(
  config: ResolvedAdminConfig,
  name: string,
  id: string,
  card: CardPlace | undefined,
): string {
  if (!card)
    return `${buildHref(config, name)}?${new URLSearchParams({ drawer: `${name}:${id}` })}`;
  const params = new URLSearchParams(card.params);
  params.set("tab", card.tab);
  params.delete("drawerTab");
  params.set("drawer", `${name}:${id}`);
  return `${card.path}?${params}`;
}

/**
 * Where each related row opens, following the target list's `rowClick`; `undefined` when none
 * can. A drawer row opens over `card` when it is given, else over the target's own list.
 */
export function openRowHrefs(
  config: ResolvedAdminConfig,
  name: string,
  resource: ResourceConfig,
  rows: ReadonlyArray<Record<string, unknown>>,
  rowKey: string,
  card?: CardPlace,
): (string | null)[] | undefined {
  const mode = resolveRowClick(resource);
  if (mode === false) return undefined;
  const hrefs =
    mode === "detail"
      ? detailRowHrefs(config, name, rows, rowKey)
      : rows.map((row) => {
          const id = rowIdentity(row, rowKey);
          return id === null ? null : drawerHref(config, name, id, card);
        });
  return hrefs.some((href) => href !== null) ? hrefs : undefined;
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
