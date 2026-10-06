import type {
  ColumnDef,
  EnumDef,
  LinkTarget,
  RequestContext,
  ResolvedAdminConfig,
  TimelineEvent,
  TimelinePage,
  TimelineSource,
  WidgetContext,
} from "@flowpanel/core";
import { toDateValue } from "@flowpanel/core/format";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";
import { scopeToRecord, viewedRecord } from "./record-scope";
import { frameworkHref } from "./resolve-link";
import { resolveReferences } from "./resolve-references";
import { openRowHrefs, resolveRowClick } from "./row-click";
import { rowIdentity } from "./row-identity";
import { retainedSince } from "./widget-context";
import { authorizedRead } from "./widget-reads";

type Row = Record<string, unknown>;

function asBounds(value: unknown): { gte?: unknown; lte?: unknown } | null {
  if (
    typeof value !== "object" ||
    value === null ||
    value instanceof Date ||
    Array.isArray(value)
  ) {
    return null;
  }
  return value as { gte?: unknown; lte?: unknown };
}

function boundTime(value: unknown): number {
  return value instanceof Date ? value.getTime() : Number(value);
}

/** The `at` bound after `before`: the host's own bound on that column still holds, narrowed. */
function combineAtBound(existing: unknown, before: Date): unknown {
  const bounds = asBounds(existing);
  if (!bounds) return { lte: before };
  const lte =
    bounds.lte !== undefined && boundTime(bounds.lte) < before.getTime() ? bounds.lte : before;
  return { ...(bounds.gte !== undefined ? { gte: bounds.gte } : {}), lte };
}

function sourceWhere(
  source: TimelineSource,
  index: number,
  kindField: string | null,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  page: TimelinePage,
): Row {
  const own = (
    typeof source.where === "function" ? source.where(ctx) : (source.where ?? {})
  ) as Row;
  const site = `timeline source ${index + 1} ("${source.resource}")`;
  const where: Row = { ...scopeToRecord(config, ctx, source.resource, own, site, true, source.by) };
  if (kindField !== null && page.kinds !== null) where[kindField] = [...page.kinds];
  if (page.before !== null) where[source.at] = combineAtBound(where[source.at], page.before);
  else if (unbounded(ctx) && where[source.at] === undefined) where[source.at] = "__notnull__";
  return where;
}

const unbounded = (ctx: WidgetContext): boolean =>
  viewedRecord(ctx) !== null && retainedSince(ctx) === undefined;

/** One source's events for a page: its rows at or before the cursor, newest first. */
export async function sourceEvents(
  source: TimelineSource,
  index: number,
  kinds: EnumDef,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  page: TimelinePage,
): Promise<TimelineEvent[]> {
  const fixed = typeof source.kind === "string" ? source.kind : null;
  if (fixed !== null && page.kinds !== null && !page.kinds.includes(fixed)) return [];
  const kindField = typeof source.kind === "string" ? null : source.kind.field;
  const refs = source.refs ?? [];
  const fields = [
    ...new Set([source.at, ...(kindField ? [kindField] : []), ...refs, ...(source.fields ?? [])]),
  ];
  const rows = await authorizedRead(
    config,
    reqCtx,
    ctx.dateRange,
    source.resource,
    {
      where: sourceWhere(source, index, kindField, ctx, config, page),
      sort: { field: source.at, dir: "desc" },
      limit: page.limit,
      fields,
      ...(unbounded(ctx) ? {} : { range: source.at }),
    },
    page.limit,
  );
  if (rows.length === 0) return [];
  const target = config.resourcesByName.get(source.resource);
  const rowKey = (target?.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
  const refDefs = ((target?.options.columns ?? []) as Array<string | ColumnDef<Row>>).filter(
    (column): column is ColumnDef<Row> =>
      typeof column === "object" && refs.includes(String(column.field)),
  );
  const labels = await resolveReferences(config, reqCtx, refDefs, rows);
  const firstRef = refDefs.find((column) => column.field === refs[0]);
  const mode = source.href === undefined && target ? resolveRowClick(target) : false;
  const opened =
    mode === "drawer" && target
      ? openRowHrefs(config, source.resource, target, rows, rowKey)
      : undefined;
  const ownLink = (row: Row, i: number): LinkTarget | undefined => {
    if (mode !== "detail") {
      const href = opened?.[i];
      return href ? frameworkHref(href) : undefined;
    }
    const id = rowIdentity(row, rowKey);
    return id === null ? undefined : { resource: source.resource, id };
  };
  const refTarget = firstRef?.reference
    ? config.resourcesByName.get(firstRef.reference.resource)
    : undefined;
  const refMode = refTarget ? resolveRowClick(refTarget) : false;
  const refLink = (refId: unknown): LinkTarget | undefined => {
    if (!firstRef?.reference || !refTarget || refId === null || refId === undefined) {
      return undefined;
    }
    if (refMode === "detail") return { resource: firstRef.reference.resource, id: String(refId) };
    if (refMode !== "drawer") return undefined;
    const refRowKey = (refTarget.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
    const built = openRowHrefs(
      config,
      firstRef.reference.resource,
      refTarget,
      [{ [refRowKey]: refId }],
      refRowKey,
    );
    const href = built?.[0];
    return href ? frameworkHref(href) : undefined;
  };
  return rows.flatMap((row, i): TimelineEvent[] => {
    const at = toDateValue(row[source.at]);
    if (!at) return [];
    const kind = fixed ?? String(row[kindField as string] ?? "");
    const refLabels = Object.fromEntries(
      refs.map((field) => {
        const label = labels.get(field)?.get(String(row[field]));
        return [field, label === undefined || label === null ? null : String(label)];
      }),
    );
    const refId = firstRef ? row[String(firstRef.field)] : undefined;
    const hasRef = firstRef?.reference && refId !== null && refId !== undefined;
    const href =
      source.href === false
        ? undefined
        : typeof source.href === "function"
          ? (source.href(row, ctx) ?? undefined)
          : hasRef
            ? refLink(refId)
            : ownLink(row, i);
    const title =
      typeof source.title === "function"
        ? source.title(row, refLabels, ctx)
        : (source.title ?? kinds.label(kind));
    const meta = source.meta?.(row, refLabels, ctx);
    const body = source.body?.(row, ctx);
    const tone = typeof source.tone === "function" ? source.tone(row) : source.tone;
    return [
      {
        at,
        kind,
        title,
        key: `${index}:${String(row[rowKey] ?? i)}`,
        ...(meta ? { meta } : {}),
        ...(body ? { body } : {}),
        ...(tone ? { tone } : {}),
        ...(href ? { href } : {}),
        ...(source.fold ? { fold: source.fold } : {}),
      },
    ];
  });
}
