import type {
  CountOptions,
  DetailTabContext,
  ReadOptions,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedDateRange,
  ResourceName,
  WidgetContext,
  WidgetDateRange,
} from "@flowpanel/core";
import { bindFormat, encodeFilters, mergeLabels, resolveFormatting } from "@flowpanel/core";
import { previousRangeFor, shiftRange } from "./date-range";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";
import { buildHref } from "./href";
import { callKey, countKey, readKey } from "./memo-key";
import { bindViewedRecord } from "./record-scope";
import { resolveLink } from "./resolve-link";
import { rowIdentity } from "./row-identity";
import { noteMemoHit } from "./widget-owner";
import { recordOf, widgetCount, widgetRead } from "./widget-reads";

type HrefOptions = { filter?: Record<string, unknown>; tab?: string };
type Thunk = () => Promise<unknown>;
type Call = (...args: unknown[]) => Promise<unknown>;

function widgetHref(
  config: ResolvedAdminConfig,
  timeZone: string,
  resource: ResourceName,
  id: string | number | undefined,
  opts: HrefOptions | undefined,
): string {
  const base =
    id === undefined ? buildHref(config, resource) : buildHref(config, resource, String(id));
  const params = new URLSearchParams();
  for (const [field, value] of Object.entries(encodeFilters(opts?.filter, timeZone))) {
    params.set(`f_${field}`, value);
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

function memoQuery(memo: Map<string, Promise<unknown>>): WidgetContext["query"] {
  function query<T>(key: string, fn: () => Promise<T>): Promise<T>;
  function query<A extends unknown[], T>(fn: (...args: A) => Promise<T>, ...args: A): Promise<T>;
  function query(first: string | Call, ...rest: unknown[]): Promise<unknown> {
    const key = typeof first === "string" ? `k:${first}` : callKey(first, rest);
    const running = memo.get(key);
    if (running) {
      noteMemoHit();
      return running;
    }
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
  range: ResolvedDateRange,
): WidgetContext["count"] {
  const count = (resource: string, where?: Record<string, unknown>, options?: CountOptions) => {
    const field = options?.range;
    const key = countKey(resource, where, field ? { field, from: range.from, to: range.to } : null);
    const running = counts.get(key);
    if (running) {
      noteMemoHit();
      return running;
    }
    const started = widgetCount(config, reqCtx, range, resource, where, options);
    counts.set(key, started);
    return started;
  };
  return count as WidgetContext["count"];
}

function memoRead(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  reads: Map<string, Promise<Record<string, unknown>[]>>,
  range: ResolvedDateRange,
): WidgetContext["read"] {
  const read = (resource: string, options?: ReadOptions) => {
    const key = readKey(resource, options, options?.range ? range : null);
    const running = reads.get(key);
    if (running) {
      noteMemoHit();
      return running;
    }
    const started = widgetRead(config, reqCtx, range, resource, options);
    reads.set(key, started);
    return started;
  };
  return read as WidgetContext["read"];
}

const DAY_MS = 86_400_000;
const RETAINED = new WeakMap<WidgetContext, number>();
const NOW = new WeakMap<WidgetContext, number>();

function retained<T extends { from: Date }>(range: T | null, since: number | undefined): T | null {
  return range !== null && since !== undefined && range.from.getTime() < since ? null : range;
}

/** A range as widgets receive it; `previous` is `null` when it starts before `retainedSince`. */
export function widgetDateRange(
  range: ResolvedDateRange,
  timeZone: string,
  retainedSince?: number,
): WidgetDateRange {
  const previous = range.from.getTime() <= 0 ? null : previousRangeFor(range, timeZone);
  return {
    from: range.from,
    to: range.to,
    preset: range.preset,
    previous: retained(previous, retainedSince),
    timeZone,
  };
}

const DERIVE = new WeakMap<
  WidgetContext,
  (range: ResolvedDateRange, keepDays?: number) => WidgetContext
>();

/** The context a widget query receives: one per range, all sharing the request's `count` memo. */
export function buildWidgetContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  dateRange: ResolvedDateRange,
  row?: Record<string, unknown>,
  rowKey: string = DEFAULT_RESOURCE_ROW_KEY,
  resource?: string,
): WidgetContext {
  const labels = mergeLabels(config.labels);
  const formatting = resolveFormatting(config.formatting);
  const timeZone = formatting.timeZone;
  const format = bindFormat(formatting);
  const id = row ? rowIdentity(row, rowKey) : null;
  const counts = new Map<string, Promise<number>>();
  const reads = new Map<string, Promise<Record<string, unknown>[]>>();
  const requestTime = Date.now();
  const ranges = new Map<string, WidgetContext>();
  const forRange = (range: ResolvedDateRange, keepDays?: number): WidgetContext => {
    const retainedSince = keepDays === undefined ? undefined : requestTime - keepDays * DAY_MS;
    const key = `${range.preset}|${range.from.getTime()}|${range.to.getTime()}|${keepDays ?? ""}`;
    const known = ranges.get(key);
    if (known) return known;
    const ctx: WidgetContext = {
      db: config.adapter.db,
      session: reqCtx.session,
      dateRange: widgetDateRange(range, timeZone, retainedSince),
      req,
      ...(row ? { row } : {}),
      ...(id !== null ? { id } : {}),
      href: (resource, recordId, opts) => widgetHref(config, timeZone, resource, recordId, opts),
      link: (target) => resolveLink(config, ctx, target) ?? "",
      query: memoQuery(new Map()),
      labels,
      format,
      sql: <Row = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) =>
        adapterSql<Row>(config, strings, values),
      count: memoCount(config, reqCtx, counts, range),
      read: memoRead(config, reqCtx, reads, range),
      rowOf: recordOf(row, resource),
    };
    if (resource !== undefined && row) bindViewedRecord(ctx, resource, row[rowKey]);
    ranges.set(key, ctx);
    DERIVE.set(ctx, forRange);
    NOW.set(ctx, requestTime);
    if (retainedSince !== undefined) RETAINED.set(ctx, retainedSince);
    return ctx;
  };
  return forRange(dateRange);
}

/** The same request's context over another range, with the same record and `count` memo. */
export function rangedContext(
  ctx: WidgetContext,
  range: ResolvedDateRange,
  keepDays?: number,
): WidgetContext {
  const derive = DERIVE.get(ctx);
  if (derive) return derive(range, keepDays);
  const now = requestNow(ctx);
  const retainedSince = keepDays === undefined ? undefined : now - keepDays * DAY_MS;
  const derived = {
    ...ctx,
    dateRange: widgetDateRange(range, ctx.dateRange.timeZone, retainedSince),
  };
  NOW.set(derived, now);
  if (retainedSince !== undefined) RETAINED.set(derived, retainedSince);
  return derived;
}

/** The moment the request built its first widget context; every context it derives shares it. */
export function requestNow(ctx: WidgetContext): number {
  return NOW.get(ctx) ?? Date.now();
}

/** The period `compare` queries: `previous`, or the same range seven calendar days back. */
export function comparisonRange(
  ctx: WidgetContext,
  against: "previous" | "weekAgo" = "previous",
): { from: Date; to: Date } | null {
  const range = ctx.dateRange;
  if (against === "previous") return range.previous;
  const week = range.from.getTime() <= 0 ? null : shiftRange(range, range.timeZone, { days: -7 });
  return retained(week, RETAINED.get(ctx));
}

/**
 * The whole record's lifetime, used when `detail.dateRange` sets no picker. Built per
 * call: a shared object would freeze `to` at process start and let one widget's
 * mutation leak into every later request.
 */
export function detailTabDateRange(): ResolvedDateRange {
  return { from: new Date(0), to: new Date(), preset: "custom" };
}

/** The narrower context a `DetailTab.render` callback receives, from a page's shared one. */
export function tabContextOf(ctx: WidgetContext): DetailTabContext {
  const { db, session, dateRange, href, link, labels, format, query, sql, count, read, rowOf, id } =
    ctx;
  return {
    db,
    session,
    dateRange,
    href,
    link,
    labels,
    format,
    query,
    sql,
    count,
    read,
    rowOf,
    ...(id !== undefined ? { id } : {}),
  };
}

/** The narrower context a `DetailTab.render` callback receives. */
export function buildDetailTabContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  row: Record<string, unknown>,
  rowKey: string = DEFAULT_RESOURCE_ROW_KEY,
  resource?: string,
): DetailTabContext {
  return tabContextOf(
    buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row, rowKey, resource),
  );
}
