import type {
  DetailTabContext,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedDateRange,
  ResourceName,
  WidgetContext,
  WidgetDateRange,
} from "@flowpanel/core";
import { bindFormat, mergeLabels, resolveFormatting } from "@flowpanel/core";
import { previousRangeFor } from "./date-range";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";
import { buildHref } from "./href";
import { callKey, countKey } from "./memo-key";
import { readRelatedCount } from "./require-authorized";
import { resolveLink } from "./resolve-link";
import { rowIdentity } from "./row-identity";

type HrefOptions = { filter?: Record<string, unknown>; tab?: string };
type Thunk = () => Promise<unknown>;
type Call = (...args: unknown[]) => Promise<unknown>;

function widgetHref(
  config: ResolvedAdminConfig,
  resource: ResourceName,
  id: string | number | undefined,
  opts: HrefOptions | undefined,
): string {
  const base =
    id === undefined ? buildHref(config, resource) : buildHref(config, resource, String(id));
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(opts?.filter ?? {})) {
    if (value === undefined || value === null) continue;
    params.set(`f_${field}`, String(value));
  }
  if (opts?.tab) params.set("tab", opts.tab);
  const query = params.toString();
  return query === "" ? base : `${base}?${query}`;
}

function adapterSql<Row>(
  config: ResolvedAdminConfig,
  strings: TemplateStringsArray,
  values: unknown[],
): Promise<Row[]> {
  const run = config.adapter.sql;
  if (!run) {
    throw new Error(
      `flowpanel: ctx.sql is unavailable — the "${config.adapter.kind}" adapter implements no ` +
        "`sql` capability. Query through ctx.db, or use an adapter that supports raw SQL.",
    );
  }
  return run<Row>(strings, ...values);
}

async function widgetCount(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  resource: ResourceName,
  where: Record<string, unknown> | undefined,
): Promise<number> {
  const target = config.resourcesByName.get(resource);
  if (!target) {
    throw new Error(
      `flowpanel: ctx.count("${resource}") — no such resource. Registered: ` +
        `${[...config.resourcesByName.keys()].join(", ") || "none"}.`,
    );
  }
  return (await readRelatedCount(config, target, reqCtx, where ?? {})) ?? 0;
}

function memoQuery(memo: Map<string, Promise<unknown>>): WidgetContext["query"] {
  function query<T>(key: string, fn: () => Promise<T>): Promise<T>;
  function query<A extends unknown[], T>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
  function query(first: string | Call, ...rest: unknown[]): Promise<unknown> {
    const key = typeof first === "string" ? `k:${first}` : callKey(first, rest);
    const running = memo.get(key);
    if (running) return running;
    const started = typeof first === "string" ? (rest[0] as Thunk)() : first(...rest);
    memo.set(key, started);
    return started;
  }
  return query;
}

function memoCount(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  counts: Map<string, Promise<number>>,
): WidgetContext["count"] {
  return (resource, where) => {
    const key = countKey(resource, where);
    const running = counts.get(key);
    if (running) return running;
    const started = widgetCount(config, reqCtx, resource, where);
    counts.set(key, started);
    return started;
  };
}

/** A range as widgets receive it: the range, the one before it, and the admin's zone. */
export function widgetDateRange(range: ResolvedDateRange, timeZone: string): WidgetDateRange {
  return {
    from: range.from,
    to: range.to,
    preset: range.preset,
    previous: range.from.getTime() <= 0 ? null : previousRangeFor(range, timeZone),
    timeZone,
  };
}

const DERIVE = new WeakMap<WidgetContext, (range: ResolvedDateRange) => WidgetContext>();

/** The context a widget query receives: one per range, all sharing the request's `count` memo. */
export function buildWidgetContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  dateRange: ResolvedDateRange,
  row?: Record<string, unknown>,
  rowKey: string = DEFAULT_RESOURCE_ROW_KEY,
): WidgetContext {
  const labels = mergeLabels(config.labels);
  const formatting = resolveFormatting(config.formatting);
  const timeZone = formatting.timeZone;
  const format = bindFormat(formatting);
  const id = row ? rowIdentity(row, rowKey) : null;
  const counts = new Map<string, Promise<number>>();
  const ranges = new Map<string, WidgetContext>();
  const forRange = (range: ResolvedDateRange): WidgetContext => {
    const key = `${range.preset}|${range.from.getTime()}|${range.to.getTime()}`;
    const known = ranges.get(key);
    if (known) return known;
    const ctx: WidgetContext = {
      db: config.adapter.db,
      session: reqCtx.session,
      dateRange: widgetDateRange(range, timeZone),
      req,
      ...(row ? { row } : {}),
      ...(id !== null ? { id } : {}),
      href: (resource, recordId, opts) => widgetHref(config, resource, recordId, opts),
      link: (target) => resolveLink(config, ctx, target) ?? "",
      query: memoQuery(new Map()),
      labels,
      format,
      sql: <Row = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) =>
        adapterSql<Row>(config, strings, values),
      count: memoCount(config, reqCtx, counts),
    };
    ranges.set(key, ctx);
    DERIVE.set(ctx, forRange);
    return ctx;
  };
  return forRange(dateRange);
}

/**
 * The same request's context over another date range: the same record, key and
 * `count` memo, and a `query` memo of its own. One context per range.
 */
export function rangedContext(ctx: WidgetContext, range: ResolvedDateRange): WidgetContext {
  const derive = DERIVE.get(ctx);
  if (derive) return derive(range);
  return { ...ctx, dateRange: widgetDateRange(range, ctx.dateRange.timeZone) };
}

/**
 * The whole record's lifetime, since a detail tab has no date picker. Built per
 * call: a shared object would freeze `to` at process start and let one widget's
 * mutation leak into every later request.
 */
export function detailTabDateRange(): ResolvedDateRange {
  return { from: new Date(0), to: new Date(), preset: "custom" };
}

/** The narrower context a `DetailTab.render` callback receives. */
export function buildDetailTabContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  row: Record<string, unknown>,
  rowKey: string = DEFAULT_RESOURCE_ROW_KEY,
): DetailTabContext {
  const ctx = buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row, rowKey);
  return {
    db: ctx.db,
    session: ctx.session,
    dateRange: ctx.dateRange,
    ...(ctx.id !== undefined ? { id: ctx.id } : {}),
    href: ctx.href,
    link: ctx.link,
    labels: ctx.labels,
    format: ctx.format,
    query: ctx.query,
    sql: ctx.sql,
    count: ctx.count,
  };
}
