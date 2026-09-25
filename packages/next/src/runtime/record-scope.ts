import {
  declaredListFields,
  type MetricWidget,
  type ResolvedAdminConfig,
  recordField,
  recordFieldError,
  type WidgetContext,
} from "@flowpanel/core";

interface ViewedRecord {
  resource: string;
  key: unknown;
}

const VIEWED = new WeakMap<WidgetContext, ViewedRecord>();

/** Remembers which record a card's context belongs to. */
export function bindViewedRecord(ctx: WidgetContext, resource: string, key: unknown): void {
  VIEWED.set(ctx, { resource, key });
}

/** The record a context belongs to; `null` on a dashboard. */
export function viewedRecord(ctx: WidgetContext): ViewedRecord | null {
  return VIEWED.get(ctx) ?? null;
}

/**
 * `where` with the viewed record's filter set on `by`, else on the one referencing field. A
 * `required` source always gets it; a count metric keeps a `where` that names a referencing
 * field and counts unscoped when none exists. A dashboard gets `where` as written.
 */
export function scopeToRecord(
  config: ResolvedAdminConfig,
  ctx: WidgetContext,
  target: string,
  where: Record<string, unknown>,
  site: string,
  required: boolean,
  by?: string,
): Record<string, unknown> {
  const viewed = viewedRecord(ctx);
  const resource = config.resourcesByName.get(target);
  if (!viewed || !resource) return where;
  if (by !== undefined) return { ...where, [by]: viewed.key };
  const found = recordField(resource, viewed.resource, required ? [] : Object.keys(where));
  if (found.kind === "own") return where;
  if (found.kind === "one") return { ...where, [found.field]: viewed.key };
  if (found.kind === "none" && !required) return where;
  const pick = required ? "by" : "where";
  throw new Error(recordFieldError(site, target, viewed.resource, found, pick) ?? site);
}

const present = (value: unknown): boolean => value !== undefined && value !== null && value !== "";

/** A count metric on a card counts, and links to, only the rows of the viewed record. */
export function scopedCountMetric(
  widget: MetricWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
): MetricWidget {
  const source = widget.source;
  if (!source || !viewedRecord(ctx)) return widget;
  const site = `metric "${widget.label}"`;
  const scope = (c: WidgetContext): Record<string, unknown> => {
    const where = typeof source.where === "function" ? source.where(c) : (source.where ?? {});
    return scopeToRecord(config, c, source.resource, where, site, false);
  };
  const range = source.range === undefined ? {} : { range: source.range };
  const target = config.resourcesByName.get(source.resource);
  const listed = target ? declaredListFields(target.options) : new Set<string>();
  return {
    ...widget,
    query: (c) => c.count(source.resource, scope(c), range),
    options: source.linked
      ? {
          ...widget.options,
          drilldown: (c) => {
            const filter = scope(c);
            const open = Object.entries(filter).every(
              ([field, value]) => listed.has(field) && present(value),
            );
            return open ? { resource: source.resource, filter, ...range } : null;
          },
        }
      : widget.options,
  };
}
