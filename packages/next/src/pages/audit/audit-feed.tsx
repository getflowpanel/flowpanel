import type {
  AuditLogEntry,
  ColumnDef,
  ColumnFormat,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import { formatLabel, mergeLabels, resolveFieldLabel, resolveFormatting } from "@flowpanel/core";
import { writeTarget } from "@flowpanel/core/internal";
import { TimeAgo } from "@flowpanel/react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  type AuditTitles,
  auditTitles,
  referenceKey,
  referencesOf,
} from "../../runtime/audit-titles";
import {
  type AuditChange,
  describeAuditAction,
  projectAuditDiff,
  readableDiffFields,
} from "../../runtime/audit-view";
import { formFieldsOf } from "../../runtime/form-fields-of";
import { formatFieldValue } from "../../runtime/format-field-value";
import { buildHref } from "../../runtime/href";
import { moneyShape } from "../../runtime/money-field";
import { renderColumnFormat } from "../../runtime/render-column-format";
import { singularLabel } from "../../runtime/resource-title";

interface FieldLook {
  label?: string;
  format?: ColumnFormat;
  /** The `auditTitles` key of the resource the field points at. */
  reference?: string;
}

/** Each field's label and format as the resource's columns and forms declare them; a money field formats as money. */
function fieldLooks(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  formatting: ResolvedFormatting,
): Map<string, FieldLook> {
  const looks = new Map<string, FieldLook>();
  const { columns } = config.adapter.introspect(writeTarget(resource));
  for (const field of formFieldsOf(resource)) {
    const name = String(field.name);
    const look: FieldLook = { ...looks.get(name) };
    if (field.label !== undefined) look.label = field.label;
    if (field.type === "money") {
      const shape = moneyShape(
        field,
        columns.find((c) => c.name === name),
        formatting,
      );
      const minorUnits = shape.storage === "minor" ? shape.minorUnits : 0;
      look.format = { kind: "money", currency: shape.currency, minorUnits };
    }
    looks.set(name, look);
  }
  for (const [field, reference] of referencesOf(resource)) {
    looks.set(field, { ...looks.get(field), reference: referenceKey(reference) });
  }
  for (const column of (resource.options.columns ?? []) as Array<
    string | ColumnDef<Record<string, unknown>>
  >) {
    if (typeof column !== "object" || !column.field) continue;
    looks.set(column.field, {
      ...looks.get(column.field),
      ...(column.label !== undefined ? { label: column.label } : {}),
      ...(column.format !== undefined ? { format: column.format } : {}),
    });
  }
  return looks;
}

/** One rendered event: what happened, to which record, by whom and when, and what changed. */
export interface AuditFeedItem {
  entry: AuditLogEntry;
  verb: string;
  record: { label: string; href: string | null } | null;
  changes: Array<{ field: string; label: string; before: ReactNode; after: ReactNode }>;
  kind: "both" | "after" | "before";
}

function shown(
  value: unknown,
  look: FieldLook | undefined,
  formatting: ResolvedFormatting,
  empty: string,
  references: AuditTitles,
  yesNo: { yes: string; no: string },
): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="fp-italic fp-text-faint">{empty}</span>;
  }
  if (typeof value === "boolean" && look?.format === undefined) return value ? yesNo.yes : yesNo.no;
  const title = look?.reference ? references.get(look.reference)?.get(String(value)) : undefined;
  if (title !== undefined) return title;
  return look?.format !== undefined
    ? renderColumnFormat(look.format, value, formatting)
    : formatFieldValue(value);
}

/** "Invoice ACME-1000": the record's title, which already reads "Invoice ACME-1000" when `detail.title` says so. */
function recordName(template: string, label: string, title: string): string {
  return title.toLowerCase().startsWith(label.toLowerCase())
    ? title
    : formatLabel(template, { label, id: title });
}

/** Events with each diff cut down to what this reader may see, and every label resolved. */
export async function auditFeedItems(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  entries: readonly AuditLogEntry[],
  labels: ResolvedLabels["audit"],
  { linkRecords }: { linkRecords: boolean },
): Promise<AuditFeedItem[]> {
  const formatting = resolveFormatting(config.formatting);
  const byResource = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    if (!entry.resource) continue;
    byResource.set(entry.resource, [...(byResource.get(entry.resource) ?? []), entry]);
  }
  const allowed = new Map<string, { fields: Set<string>; looks: Map<string, FieldLook> }>();
  await Promise.all(
    [...byResource].map(async ([name, list]) => {
      const resource = config.resourcesByName.get(name);
      if (!resource) return;
      const fields = await readableDiffFields(
        config,
        resource,
        list.map((entry) => entry.diff),
        reqCtx,
      );
      allowed.set(name, { fields, looks: fieldLooks(config, resource, formatting) });
    }),
  );
  const titles = await auditTitles(config, reqCtx, entries, linkRecords);
  const yesNo = mergeLabels(config.labels).filters;
  return entries.map((entry) => {
    const resource = entry.resource ? config.resourcesByName.get(entry.resource) : undefined;
    const access = entry.resource ? allowed.get(entry.resource) : undefined;
    const changes: AuditChange[] = access ? projectAuditDiff(entry.diff, access.fields) : [];
    const record =
      linkRecords && entry.resource && entry.targetId
        ? {
            label: recordName(
              labels.record,
              resource ? singularLabel(resource, entry.resource) : entry.resource,
              titles.records.get(entry.resource)?.get(entry.targetId) ?? entry.targetId,
            ),
            href: resource ? buildHref(config, entry.resource, entry.targetId) : null,
          }
        : null;
    const kind =
      entry.diff?.before === null ? "after" : entry.diff?.after === null ? "before" : "both";
    return {
      entry,
      verb: describeAuditAction(config, entry, labels),
      record,
      kind,
      changes: changes.map((change) => {
        const look = access?.looks.get(change.field);
        return {
          field: change.field,
          label: resolveFieldLabel(look?.label, change.field),
          before: shown(
            change.before,
            look,
            formatting,
            labels.emptyValue,
            titles.references,
            yesNo,
          ),
          after: shown(change.after, look, formatting, labels.emptyValue, titles.references, yesNo),
        };
      }),
    };
  });
}

function Changes({
  item,
  labels,
}: {
  item: AuditFeedItem;
  labels: ResolvedLabels["audit"];
}): ReactNode {
  if (item.changes.length === 0) return null;
  return (
    <dl className="fp-mt-2 fp-grid fp-grid-cols-1 fp-gap-x-4 fp-gap-y-1.5 fp-text-sm sm:fp-grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
      {item.changes.map((change) => (
        <div key={change.field} className="fp-contents">
          <dt className="fp-truncate fp-text-soft">{change.label}</dt>
          <dd className="fp-flex fp-min-w-0 fp-flex-wrap fp-items-baseline fp-gap-x-2 fp-break-words">
            {item.kind !== "after" ? (
              <span className={item.kind === "both" ? "fp-text-faint fp-line-through" : ""}>
                <span className="fp-sr-only">{labels.before}: </span>
                {change.before}
              </span>
            ) : null}
            {item.kind === "both" ? (
              <span aria-hidden="true" className="fp-text-faint">
                →
              </span>
            ) : null}
            {item.kind !== "before" ? (
              <span className="fp-text-ink">
                <span className="fp-sr-only">{labels.after}: </span>
                {change.after}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A newest-first list of audit events in one bordered block. */
function actorOf(
  entry: Pick<AuditLogEntry, "actorName" | "actorId">,
  labels: ResolvedLabels["audit"],
): string {
  return entry.actorName ?? entry.actorId ?? labels.unknownActor;
}

export function AuditFeed({
  items,
  labels,
}: {
  items: readonly AuditFeedItem[];
  labels: ResolvedLabels["audit"];
}): ReactNode {
  return (
    <ol className="fp-divide-y fp-divide-line fp-rounded-lg fp-border fp-border-line fp-bg-surface">
      {items.map((item) => (
        <li key={item.entry.id} className="fp-px-4 fp-py-3 sm:fp-px-6" data-fp-audit-event="">
          <div className="fp-flex fp-items-baseline fp-justify-between fp-gap-3">
            <p className="fp-min-w-0 fp-text-sm">
              <span className="fp-font-medium fp-text-ink">{item.verb}</span>
              {item.record ? (
                <>
                  {" "}
                  {item.record.href ? (
                    <Link
                      href={item.record.href}
                      prefetch={false}
                      className="fp-text-ink fp-underline fp-decoration-line fp-underline-offset-4 hover:fp-decoration-ink"
                    >
                      {item.record.label}
                    </Link>
                  ) : (
                    <span className="fp-text-ink">{item.record.label}</span>
                  )}
                </>
              ) : null}
              <span className="fp-text-soft">
                {" · "}
                <span
                  className="fp-inline-block fp-max-w-full fp-truncate fp-align-bottom"
                  title={actorOf(item.entry, labels)}
                >
                  {actorOf(item.entry, labels)}
                </span>
              </span>
            </p>
            <span className="fp-shrink-0 fp-text-xs fp-tabular-nums fp-text-faint">
              <TimeAgo date={item.entry.at} />
            </span>
          </div>
          <Changes item={item} labels={labels} />
        </li>
      ))}
    </ol>
  );
}
