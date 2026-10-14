import type {
  DashboardLink,
  Link,
  LinkTarget,
  ResolvedAdminConfig,
  ResourceConfig,
  ResourceLink,
  WidgetContext,
} from "@flowpanel/core";
import { didYouMean, encodeFilters } from "@flowpanel/core/internal";
import { buildHref, buildPath } from "./href";
import { columnMoneyFactors } from "./money-field";

/** A row a query returned, with its link resolved to the href a card renders. */
export type LinkedRow<T> = Omit<T, "href"> & { href?: string };

const warned = new Set<string>();
const frameworkHrefs = new Set<string>();

/** Mark an href the framework itself built (e.g. a drawer/detail row link) so it never
 * triggers the "spells the admin's mount path" warning meant for a host's own literal string. */
export function frameworkHref(href: string): string {
  if (process.env.NODE_ENV !== "production") frameworkHrefs.add(href);
  return href;
}

function warnMountLiteral(config: ResolvedAdminConfig, href: string): void {
  const base = config.paths.admin;
  if (process.env.NODE_ENV === "production" || !base || base === "/" || warned.has(href)) return;
  if (frameworkHrefs.has(href)) return;
  if (href !== base && !href.startsWith(`${base}/`) && !href.startsWith(`${base}?`)) return;
  warned.add(href);
  console.warn(
    `[flowpanel] link "${href}" spells the admin's mount path. Name the target instead — ` +
      '{ resource: "…" } or { dashboard: "/…" } — so a renamed mount path cannot break it.',
  );
}

function withQuery(base: string, params: URLSearchParams): string {
  const query = params.toString();
  return query === "" ? base : `${base}?${query}`;
}

function setFilters(
  params: URLSearchParams,
  filters: Record<string, unknown> | undefined,
  timeZone: string,
  resource: ResourceConfig,
): void {
  const encoded = encodeFilters(filters, timeZone, columnMoneyFactors(resource));
  for (const [field, value] of Object.entries(encoded)) {
    params.set(`f_${field}`, value);
  }
}

function applyView(
  params: URLSearchParams,
  resource: ResourceConfig,
  target: ResourceLink,
  timeZone: string,
): void {
  const views = resource.options.views ?? [];
  const view = views.find((candidate) => candidate.name === target.view);
  if (!view) {
    throw new Error(
      `flowpanel: link to view "${target.view}" of "${target.resource}" — no such view.` +
        `${didYouMean(
          String(target.view),
          views.map((candidate) => candidate.name),
        )} ` +
        `Views: ${views.map((candidate) => candidate.name).join(", ") || "none"}.`,
    );
  }
  if (view.search) params.set("q", view.search);
  if (view.sort) params.set("sort", `${view.sort.field}:${view.sort.dir}`);
  setFilters(params, view.filters, timeZone, resource);
}

const wholeHistory = (ctx: WidgetContext): boolean => ctx.dateRange.from.getTime() <= 0;

function resourceHref(
  config: ResolvedAdminConfig,
  ctx: WidgetContext,
  target: ResourceLink,
): string {
  const resource = config.resourcesByName.get(target.resource);
  if (!resource) {
    const known = [...config.resourcesByName.keys()];
    throw new Error(
      `flowpanel: link to resource "${target.resource}" — no such resource.` +
        `${didYouMean(target.resource, known)} Registered: ${known.join(", ") || "none"}.`,
    );
  }
  const { from, to, timeZone } = ctx.dateRange;
  const params = new URLSearchParams();
  if (target.view !== undefined) applyView(params, resource, target, timeZone);
  setFilters(params, target.filter, timeZone, resource);
  if (target.range && !wholeHistory(ctx)) {
    params.set(`f_${target.range}`, `${from.toISOString()}~${to.toISOString()}`);
  }
  if (target.tab) params.set("tab", target.tab);
  const base =
    target.id === undefined
      ? buildHref(config, target.resource)
      : buildHref(config, target.resource, String(target.id));
  return withQuery(base, params);
}

function rangeParams(ctx: WidgetContext): URLSearchParams {
  const range = ctx.dateRange;
  if (wholeHistory(ctx)) return new URLSearchParams();
  if (range.preset !== "custom") return new URLSearchParams({ preset: range.preset });
  return new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
}

function routePath(path: string): string {
  const trimmed = path.trim().replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function dashboardHref(
  config: ResolvedAdminConfig,
  ctx: WidgetContext,
  target: DashboardLink,
): string {
  const path = routePath(target.dashboard);
  if (!config.dashboardsByPath.has(path) && !config.pagesByPath.has(path)) {
    const known = [...config.dashboardsByPath.keys(), ...config.pagesByPath.keys()];
    throw new Error(
      `flowpanel: link to dashboard "${target.dashboard}" — no such dashboard or page.` +
        `${didYouMean(path, known)} Registered: ${known.join(", ") || "none"}.`,
    );
  }
  const base = path === "/" ? buildHref(config) : buildPath(config, path);
  const params = target.range === false ? new URLSearchParams() : rangeParams(ctx);
  const declared = (config.dashboardsByPath.get(path)?.filters ?? []).map((filter) => filter.key);
  for (const [key, value] of Object.entries(target.filter ?? {})) {
    if (!declared.includes(key)) {
      throw new Error(
        `flowpanel: link to dashboard "${target.dashboard}" sets the filter "${key}", which it does ` +
          `not declare.${didYouMean(key, declared)} Declared: ${declared.join(", ") || "none"}.`,
      );
    }
    params.set(`f_${key}`, value);
  }
  return withQuery(base, params);
}

/**
 * The href a widget link stands for: a string as written, a named target under
 * the admin's mount, or what a function returns for this widget context.
 */
export function resolveLink(
  config: ResolvedAdminConfig,
  ctx: WidgetContext,
  link: Link | null | undefined,
): string | undefined {
  const target: LinkTarget | null | undefined = typeof link === "function" ? link(ctx) : link;
  if (target === undefined || target === null) return undefined;
  if (typeof target === "string") {
    warnMountLiteral(config, target);
    return target;
  }
  return "resource" in target
    ? resourceHref(config, ctx, target)
    : dashboardHref(config, ctx, target);
}

/** Rows a query returned, each named link resolved to the href a card renders. */
export function linkRows<T extends { href?: LinkTarget | undefined }>(
  config: ResolvedAdminConfig,
  ctx: WidgetContext,
  rows: readonly T[],
): LinkedRow<T>[] {
  return rows.map(({ href, ...rest }) => {
    const resolved = resolveLink(config, ctx, href);
    return resolved === undefined ? rest : { ...rest, href: resolved };
  });
}
