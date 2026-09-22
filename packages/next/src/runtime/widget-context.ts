import type {
  DetailTabContext,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedDateRange,
  ResourceName,
  WidgetContext,
} from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { buildHref } from "./href";
import { readRelatedCount } from "./require-authorized";

type HrefOptions = { filter?: Record<string, unknown>; tab?: string };

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

/**
 * The context every widget query receives. `query` memoises per context, and a
 * page builds one context, so two widgets asking the same question query once.
 * The memo holds the promise, so a rejection is shared rather than retried.
 */
export function buildWidgetContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  dateRange: ResolvedDateRange,
  row?: Record<string, unknown>,
): WidgetContext {
  const memo = new Map<string, Promise<unknown>>();
  return {
    db: config.adapter.db,
    session: reqCtx.session,
    dateRange,
    req,
    ...(row ? { row } : {}),
    href: (resource, id, opts) => widgetHref(config, resource, id, opts),
    query: <T>(key: string, fn: () => Promise<T>): Promise<T> => {
      const running = memo.get(key);
      if (running) return running as Promise<T>;
      const started = fn();
      memo.set(key, started);
      return started;
    },
    labels: mergeLabels(config.labels),
    sql: <Row = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) =>
      adapterSql<Row>(config, strings, values),
    count: (resource, where) => widgetCount(config, reqCtx, resource, where),
  };
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
): DetailTabContext {
  const ctx = buildWidgetContext(config, reqCtx, req, detailTabDateRange(), row);
  return {
    db: ctx.db,
    session: ctx.session,
    dateRange: ctx.dateRange,
    href: ctx.href,
    labels: ctx.labels,
    query: ctx.query,
    sql: ctx.sql,
    count: ctx.count,
  };
}
