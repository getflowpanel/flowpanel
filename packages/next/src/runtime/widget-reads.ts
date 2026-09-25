import type {
  CountOptions,
  ReadOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetContext,
} from "@flowpanel/core";
import { assertColumn, didYouMean, normalizeWhere, withRange } from "@flowpanel/core";
import { readRelatedCount, readRelatedPage } from "./require-authorized";
import { currentWidgetOwner, describeOwner } from "./widget-owner";

export const READ_LIMIT = 100;
export const READ_LIMIT_MAX = 1000;

const warned = new Set<string>();

/** A development warning, printed once per key for the life of the process. */
export function warnOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production" || warned.has(key)) return;
  warned.add(key);
  const owner = currentWidgetOwner();
  console.warn(`[flowpanel] ${message}${owner ? ` In ${describeOwner(owner)}.` : ""}`);
}

/** The registered resource a widget read names; a typo throws with the closest name. */
export function resourceNamed(
  config: ResolvedAdminConfig,
  call: string,
  name: string,
): ResourceConfig {
  const target = config.resourcesByName.get(name);
  if (target) return target;
  const known = [...config.resourcesByName.keys()];
  throw new Error(
    `flowpanel: ${call} — no such resource.${didYouMean(name, known)} ` +
      `Registered: ${known.join(", ") || "none"}. If "${name}" is a table in your schema, ` +
      "register it: resource(schema.<table>, { hidden: true }).",
  );
}

/** The column names the adapter reports for a resource. */
export function columnsOf(config: ResolvedAdminConfig, target: ResourceConfig): string[] {
  return config.adapter.introspect(target.ref).columns.map((column) => column.name);
}

/** `limit` as a read runs it: a whole number from 1 to `max`. */
export function clampReadLimit(limit: number | undefined, max = READ_LIMIT_MAX): number {
  if (limit === undefined || !Number.isFinite(limit)) return Math.min(READ_LIMIT, max);
  return Math.min(Math.max(Math.trunc(limit), 1), max);
}

type Span = { from: Date; to: Date };

/**
 * Rows of a resource through the same authorized read its related tabs use, checked, bounded by
 * `range` on `options.range` and clamped to `max`, with no warning.
 */
export async function authorizedRead(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  range: Span,
  resource: string,
  options: ReadOptions = {},
  max = READ_LIMIT_MAX,
): Promise<Record<string, unknown>[]> {
  const call = `ctx.read("${resource}")`;
  const target = resourceNamed(config, call, resource);
  const columns = columnsOf(config, target);
  const where = normalizeWhere(call, options.where ?? {}, columns);
  if (options.sort) assertColumn(call, options.sort.field, columns, "sorts by");
  for (const field of options.fields ?? []) assertColumn(call, field, columns, "reads");
  if (where === null) return [];
  const page = await readRelatedPage(config, target, reqCtx, {
    filters: withRange(call, where, options.range, range, columns),
    page: 1,
    pageSize: clampReadLimit(options.limit, max),
    ...(options.sort ? { sort: options.sort } : {}),
    ...(options.fields ? { extraFields: options.fields } : {}),
  });
  return page?.rows ?? [];
}

/** `ctx.read`: an authorized read that warns once when it fills the 1000-row ceiling. */
export async function widgetRead(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  range: Span,
  resource: string,
  options: ReadOptions = {},
): Promise<Record<string, unknown>[]> {
  const call = `ctx.read("${resource}")`;
  const rows = await authorizedRead(config, reqCtx, range, resource, options);
  if (rows.length === READ_LIMIT_MAX) {
    warnOnce(
      `read:${resource}`,
      `${call} returned ${READ_LIMIT_MAX} rows, the most one read returns, so a total or a ` +
        "series over them undercounts. Narrow the where, or count with ctx.count.",
    );
  }
  return rows;
}

const missingValue = (value: unknown): boolean =>
  value === undefined || value === null || value === "";

/**
 * `ctx.count`: rows of a resource matching `where`, under the same checks as its list. Every key
 * is checked first; then an `undefined`, `null` or `""` value counts 0, as `undefined` has since
 * 0.3.0, and warns in development.
 */
export async function widgetCount(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  range: Span,
  resource: string,
  where: Record<string, unknown> = {},
  options: CountOptions = {},
): Promise<number> {
  const call = `ctx.count("${resource}")`;
  const target = resourceNamed(config, call, resource);
  const columns = columnsOf(config, target);
  for (const field of Object.keys(where)) assertColumn(call, field, columns);
  const missing = Object.entries(where).find(([, value]) => missingValue(value));
  if (missing) {
    const [field, value] = missing;
    warnOnce(
      `count:${resource}:${field}`,
      `${call} filters "${field}" by ${value === "" ? '""' : String(value)} and counts 0. ` +
        'Leave the field out, or pass "__null__" to count empty values.',
    );
    return 0;
  }
  const filters = normalizeWhere(call, where, columns);
  if (filters === null) return 0;
  const scoped = withRange(call, filters, options.range, range, columns);
  return (await readRelatedCount(config, target, reqCtx, scoped)) ?? 0;
}

/** `ctx.rowOf`: the card's record, checked against the resource the caller names. */
export function recordOf(
  row: Record<string, unknown> | undefined,
  owner: string | undefined,
): WidgetContext["rowOf"] {
  const rowOf = (name: string) => {
    if (!row) {
      throw new Error(
        `flowpanel: ctx.rowOf("${name}") — this widget has no record; it sits on a dashboard. ` +
          `Read rows with ctx.read("${name}", { where }) instead.`,
      );
    }
    if (owner !== undefined && owner !== name) {
      throw new Error(
        `flowpanel: ctx.rowOf("${name}") — this widget sits on a "${owner}" card, not a ` +
          `"${name}" card. Use ctx.rowOf("${owner}"), or ctx.read("${name}", { where }).`,
      );
    }
    return row;
  };
  return rowOf as WidgetContext["rowOf"];
}
