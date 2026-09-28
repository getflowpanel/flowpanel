import { recordField, recordFieldError, referencingFields } from "./internal/related-by";
import { timelineKindsOf } from "./internal/timeline-merge";
import { checkColumn as checkField, missing } from "./internal/validate-shared";
import { didYouMean } from "./suggest";
import type { DashboardConfig } from "./types/dashboard";
import type { ResourceConfig } from "./types/resource";
import type { WidgetConfig } from "./types/widget";
import type { TimelineSource } from "./types/widget-timeline";
import type { LinkCheck } from "./validate-links";

function referenceColumns(target: ResourceConfig): string[] {
  return (target.options.columns ?? []).flatMap((column) => {
    const def = column as { field?: unknown; reference?: unknown };
    return typeof column === "object" && def.reference && typeof def.field === "string"
      ? [def.field]
      : [];
  });
}

type RecordSource = { resource: string; where?: unknown; by?: string };

function recordFieldOf(
  site: string,
  source: RecordSource,
  target: ResourceConfig,
  parent: string,
): string {
  const candidates = referencingFields(target, parent);
  if (source.by !== undefined) {
    if (candidates.includes(source.by)) return source.by;
    throw new Error(
      `flowpanel: ${site}.by names "${source.by}", which does not declare reference: ` +
        `{ resource: "${parent}" } on "${source.resource}".${didYouMean(source.by, candidates)}`,
    );
  }
  const found = recordField(target, parent, []);
  if (found.kind === "one") return found.field;
  throw new Error(recordFieldError(site, source.resource, parent, found, "by") ?? site);
}

/** One source: its resource and fields exist, and on a card one field, or `by`, points at the record. */
export function checkRecordSource(
  site: string,
  source: RecordSource,
  fields: readonly string[],
  parent: string | null,
  check: LinkCheck,
): ResourceConfig {
  const target = check.resourcesByName.get(source.resource);
  if (!target)
    return missing(`${site}.resource`, "resource", source.resource, [
      ...check.resourcesByName.keys(),
    ]);
  const where =
    typeof source.where === "object" && source.where !== null ? Object.keys(source.where) : [];
  for (const field of [...fields, ...where]) checkField(`${site}`, source.resource, field, check);
  if (source.by !== undefined) checkField(`${site}.by`, source.resource, source.by, check);
  if (parent === null) return target;
  const field = recordFieldOf(site, source, target, parent);
  if (where.includes(field)) {
    throw new Error(
      `flowpanel: ${site} sets ${field} in where, which the record page fills; remove it.`,
    );
  }
  return target;
}

function checkTimelineSource(
  site: string,
  source: TimelineSource,
  kinds: readonly string[],
  parent: string | null,
  check: LinkCheck,
): void {
  checkField(`${site}.at`, source.resource, source.at, check);
  if (typeof source.kind === "string") {
    if (!kinds.includes(source.kind)) missing(`${site}.kind`, "kind", source.kind, kinds);
  } else {
    checkField(`${site}.kind.field`, source.resource, source.kind.field, check);
  }
  const target = checkRecordSource(site, source, source.fields ?? [], parent, check);
  const referenced = referenceColumns(target);
  for (const field of source.refs ?? []) {
    if (referenced.includes(field)) continue;
    throw new Error(
      `flowpanel: ${site}.refs names "${field}", which is not a reference column of ` +
        `"${source.resource}"; declare reference on that column.${didYouMean(field, referenced)}`,
    );
  }
}

function checkWidgets(
  site: string,
  widgets: readonly WidgetConfig[],
  parent: string | null,
  check: LinkCheck,
): void {
  widgets.forEach((widget, w) => {
    if (widget.kind === "heatmap") {
      const { source, query } = widget.options;
      if (!source && !query) {
        throw new Error(`flowpanel: ${site}[${w}] is a heatmap with neither source nor query.`);
      }
      if (source) {
        const fields = [source.at, ...(source.value ? [source.value] : [])];
        checkRecordSource(`${site}[${w}].options.source`, source, fields, parent, check);
      }
      return;
    }
    if (widget.kind !== "timeline") return;
    const kinds = timelineKindsOf(widget.options.kinds).values;
    (widget.options.sources ?? []).forEach((source, s) => {
      checkTimelineSource(`${site}[${w}].options.sources[${s}]`, source, kinds, parent, check);
    });
  });
}

/**
 * Throws at `defineAdmin` when a timeline source names a resource, a field or a kind that does
 * not exist, a `refs` field without a declared reference, or — on a record page — cannot tell
 * which field points at the record, or sets that field in a static `where`.
 */
export function validateRecordSources(
  check: LinkCheck,
  dashboards: readonly DashboardConfig[],
): void {
  for (const board of dashboards) {
    (board.sections ?? []).forEach((section, s) => {
      checkWidgets(
        `dashboard "${board.path}" sections[${s}].widgets`,
        section.widgets,
        null,
        check,
      );
    });
  }
  for (const [name, resource] of check.resourcesByName) {
    const detail = resource.options.detail;
    checkWidgets(`resource "${name}" detail.aside`, detail?.aside ?? [], name, check);
    (detail?.tabs ?? []).forEach((tab, t) => {
      checkWidgets(`resource "${name}" detail.tabs[${t}].widgets`, tab.widgets ?? [], name, check);
    });
  }
}
