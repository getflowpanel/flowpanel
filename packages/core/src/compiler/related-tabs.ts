import { relatedMark } from "../builders/related";
import { pointingField, recordFieldError } from "../internal/related-by";
import type { DetailTab } from "../types/detail";
import type { ResourceConfig } from "../types/resource";

type Row = Record<string, unknown>;

function inferredBy(name: string, tab: DetailTab<Row>, target: ResourceConfig): string {
  const found = pointingField(target, name);
  if (found.kind === "one") return found.field;
  const site = `resource "${name}" tab "${tab.key}"`;
  throw new Error(recordFieldError(site, String(tab.resource), name, found, "by"));
}

function resolveTab(
  name: string,
  rowKey: string,
  tab: DetailTab<Row>,
  byName: ReadonlyMap<string, ResourceConfig>,
): DetailTab<Row> {
  const mark = relatedMark(tab);
  if (typeof tab.resource !== "string" || (!mark && tab.by === undefined)) return tab;
  const target = byName.get(tab.resource);
  if (!target) return tab;
  const out: DetailTab<Row> = { ...tab };
  if (mark && !mark.explicit && tab.label === mark.label) {
    out.label = target.options.plural ?? target.options.label ?? tab.label;
  }
  const by = tab.by ?? (tab.filter === undefined ? inferredBy(name, tab, target) : undefined);
  if (by === undefined) return out;
  out.by = by;
  if (tab.filter === undefined) out.filter = (row) => ({ [by]: row[rowKey] });
  if (tab.hide === undefined) out.hide = [by];
  return out;
}

/**
 * Resolves each related tab's `by` — given, or inferred for a `related()` tab — into its
 * `filter` and `hide`. A plain tab without `by` is left as written.
 */
export function resolveRelatedTabs(
  name: string,
  resource: ResourceConfig,
  byName: ReadonlyMap<string, ResourceConfig>,
): ResourceConfig {
  const tabs = resource.options.detail?.tabs as DetailTab<Row>[] | undefined;
  if (!tabs || tabs.length === 0) return resource;
  const rowKey = resource.options.rowKey ?? "id";
  const resolved = tabs.map((tab) => resolveTab(name, rowKey, tab, byName));
  if (resolved.every((tab, index) => tab === tabs[index])) return resource;
  return {
    ...resource,
    options: { ...resource.options, detail: { ...resource.options.detail, tabs: resolved } },
  };
}
