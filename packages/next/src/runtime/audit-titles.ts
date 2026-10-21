import type {
  AuditLogEntry,
  DetailHeaderContext,
  DetailOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { columnDefs } from "./column-defs";
import { detailReadPlan } from "./detail-read-plan";
import { formFieldsOf } from "./form-fields-of";
import { mayListDeleted } from "./list-rows";
import { labelValue } from "./record-label";
import { readRelatedRows } from "./require-authorized";
import { buildWidgetContext, detailTabDateRange } from "./widget-context";

type Row = Record<string, unknown>;

/** Titles by resource, then by record id; a record the reader may not read has none. */
export type AuditTitles = Map<string, Map<string, string>>;

function shownText(value: unknown): string | undefined {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** A field's reference: the resource it points at, and the field its picker shows. */
export function referencesOf(
  resource: ResourceConfig,
): Map<string, { resource: string; labelField?: string }> {
  const out = new Map<string, { resource: string; labelField?: string }>();
  for (const field of formFieldsOf(resource)) {
    if (field.reference) out.set(field.name, field.reference);
  }
  for (const column of columnDefs(resource)) {
    if (column.field && column.reference) out.set(column.field, column.reference);
  }
  return out;
}

async function titlesOf(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  name: string,
  ids: ReadonlySet<string>,
  ctx: DetailHeaderContext,
  labelField?: string,
  found?: Set<string>,
): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const resource = config.resourcesByName.get(name);
  if (!resource || ids.size === 0) return titles;
  const pk = config.adapter.introspect(resource.ref).primaryKey;
  const plan = await detailReadPlan(config, resource, reqCtx, new URLSearchParams());
  const rows = await readRelatedRows(config, resource, reqCtx, {
    filters: { [pk]: { op: "in", values: [...ids] } },
    pageSize: ids.size,
    extraFields: [pk, ...plan.readableBaseFields, ...(labelField ? [labelField] : [])],
    includeDeleted: await mayListDeleted(resource, reqCtx),
  });
  const title = (resource.options.detail as DetailOptions<Row> | undefined)?.title;
  for (const row of rows ?? []) {
    found?.add(String(row[pk]));
    const declared = title ? shownText(await title(row, ctx)) : undefined;
    const picked = labelField ? shownText(row[labelField]) : undefined;
    const text = picked ?? declared ?? labelValue(row);
    if (text !== undefined) titles.set(String(row[pk]), text);
  }
  return titles;
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function add(map: Map<string, Set<string>>, key: string, value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  map.set(key, (map.get(key) ?? new Set()).add(String(value)));
}

/** Each event's record and each referenced record in its diff, by title, and the records still there, as this reader may read them. */
export async function auditTitles(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  entries: readonly AuditLogEntry[],
  withRecords: boolean,
): Promise<{
  records: AuditTitles;
  references: AuditTitles;
  present: Map<string, Set<string>>;
}> {
  const targets = new Map<string, Set<string>>();
  const referenced = new Map<string, Set<string>>();
  const labelFields = new Map<string, string | undefined>();
  for (const entry of entries) {
    if (!entry.resource) continue;
    if (withRecords && entry.targetId) add(targets, entry.resource, entry.targetId);
    const resource = config.resourcesByName.get(entry.resource);
    if (!resource) continue;
    for (const [field, reference] of referencesOf(resource)) {
      const key = referenceKey(reference);
      labelFields.set(key, reference.labelField);
      for (const side of [entry.diff?.before, entry.diff?.after]) {
        if (isRow(side)) add(referenced, key, side[field]);
      }
    }
  }
  const widget = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange());
  const ctx: DetailHeaderContext = {
    format: widget.format,
    labels: widget.labels,
    link: widget.link,
  };
  const records: AuditTitles = new Map();
  const references: AuditTitles = new Map();
  const present = new Map<string, Set<string>>();
  await Promise.all([
    ...[...targets].map(async ([name, ids]) => {
      const found = new Set<string>();
      present.set(name, found);
      records.set(name, await titlesOf(config, reqCtx, name, ids, ctx, undefined, found));
    }),
    ...[...referenced].map(async ([key, ids]) => {
      const [name = ""] = key.split("\u0000");
      references.set(key, await titlesOf(config, reqCtx, name, ids, ctx, labelFields.get(key)));
    }),
  ]);
  return { records, references, present };
}

/** The key `auditTitles` files a reference's titles under. */
export function referenceKey(reference: { resource: string; labelField?: string }): string {
  return `${reference.resource}\u0000${reference.labelField ?? ""}`;
}
