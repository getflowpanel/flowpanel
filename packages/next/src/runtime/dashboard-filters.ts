import type { DashboardConfig, DashboardFilter, WidgetContext } from "@flowpanel/core";
import { isEnumDef } from "@flowpanel/core";

/** A dashboard filter as its select shows it: plain choices and the value in the URL. */
export interface DashboardFilterView {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string | null;
}

/** The declared filters set in the URL, as `ctx.filters`. */
export function activeFilters(
  dashboard: DashboardConfig,
  searchParams: URLSearchParams,
): Record<string, string> {
  const active: Record<string, string> = {};
  for (const filter of dashboard.filters ?? []) {
    const value = searchParams.get(`f_${filter.key}`);
    if (value) active[filter.key] = value;
  }
  return active;
}

async function choices(filter: DashboardFilter, ctx: WidgetContext) {
  try {
    const options =
      typeof filter.options === "function"
        ? await filter.options(ctx)
        : isEnumDef(filter.options)
          ? filter.options.options
          : filter.options;
    return options.map((option) => ({ label: option.label, value: String(option.value) }));
  } catch (error) {
    console.error(`[flowpanel] dashboard filter options failed for "${filter.key}":`, error);
    return [];
  }
}

/** Every declared filter with its resolved choices and its current value. */
export function filterChoices(
  dashboard: DashboardConfig,
  ctx: WidgetContext,
): Promise<DashboardFilterView[]> {
  return Promise.all(
    (dashboard.filters ?? []).map(async (filter) => {
      const options = await choices(filter, ctx);
      const value = ctx.filters[filter.key] ?? null;
      const listed = value === null || options.some((option) => option.value === value);
      return {
        key: filter.key,
        label: filter.label,
        options: listed ? options : [...options, { label: value, value }],
        value,
      };
    }),
  );
}

function withParams(ctx: WidgetContext, edit: (params: URLSearchParams) => void): string {
  const url = new URL(ctx.req.url);
  edit(url.searchParams);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const query = url.searchParams.toString();
  return query === "" ? path : `${path}?${query}`;
}

/** The current dashboard with one filter set, its range and other filters kept. */
export function filterHref(ctx: WidgetContext, key: string, value: string): string {
  return withParams(ctx, (params) => params.set(`f_${key}`, value));
}

/** The current dashboard with every filter cleared, its range kept. */
export function clearFiltersHref(ctx: WidgetContext): string {
  return withParams(ctx, (params) => {
    for (const key of [...params.keys()]) if (key.startsWith("f_")) params.delete(key);
  });
}

/** Rows whose link sets the dashboard filter to the row's key; unchanged without a filter. */
export function withFilterHrefs<T extends { href?: string }>(
  ctx: WidgetContext,
  filter: string | undefined,
  rows: readonly T[],
  keyOf: (row: T) => string | null,
): T[] {
  if (!filter) return [...rows];
  return rows.map((row) => {
    const key = keyOf(row);
    return key === null ? row : { ...row, href: filterHref(ctx, filter, key) };
  });
}
