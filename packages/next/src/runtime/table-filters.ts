import type {
  ResolvedAdminConfig,
  ResourceConfig,
  TableWidgetOptions,
  WidgetContext,
} from "@flowpanel/core";
import { normalizeWhere, withRange } from "@flowpanel/core/internal";

/** The `resource` read's filters from `where` and `range`; `null` for a where no row can match. */
export function tableFilters(
  options: TableWidgetOptions,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
): Record<string, unknown> | null {
  if (options.where === undefined && options.range === undefined) return {};
  const call = `table("${String(options.resource)}")`;
  const columns = config.adapter.introspect(resource.ref).columns.map((column) => column.name);
  const where = typeof options.where === "function" ? options.where(ctx) : (options.where ?? {});
  const filters = normalizeWhere(call, where, columns);
  return filters === null ? null : withRange(call, filters, options.range, ctx.dateRange, columns);
}
