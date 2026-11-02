import type {
  DateRangePreset,
  RequestContext,
  ResolvedAdminConfig,
  Session,
  WidgetContext,
} from "@flowpanel/core";
import { requestWidgetContext } from "@flowpanel/next";

export interface AdminWidgetContextOptions {
  /** The signed-in session widgets see as `ctx.session`. @defaultValue null */
  session?: Session | null;
  /** The role every access check compares. @defaultValue "admin" */
  role?: string;
  /** The picked period; its previous period follows. @defaultValue the whole history until now */
  range?: { from: Date; to: Date; preset?: DateRangePreset };
  /** The viewed record, for a record-page widget. */
  row?: Record<string, unknown>;
  /** The resource `row` belongs to: its `rowKey` names `ctx.id`, and `ctx.rowOf` checks it. */
  resource?: string;
  /** The dashboard filters widgets read as `ctx.filters`. @defaultValue {} */
  filters?: Readonly<Record<string, string>>;
  /** @defaultValue `http://localhost` followed by the admin's mount */
  url?: string;
}

/**
 * The context a widget receives in this admin — its memo, links, formatters, access checks
 * and adapter — for a unit or integration test. It is an admin with no tenant scope, so it
 * lives here and never in a page.
 */
export function adminWidgetContext(
  config: ResolvedAdminConfig,
  options: AdminWidgetContextOptions = {},
): WidgetContext {
  const reqCtx: RequestContext = {
    req: new Request(options.url ?? `http://localhost${config.paths.admin}`),
    session: options.session ?? null,
    role: options.role ?? "admin",
    scope: null,
    ip: null,
    userAgent: null,
  };
  return requestWidgetContext(config, reqCtx, {
    ...(options.range ? { range: options.range } : {}),
    ...(options.row ? { row: options.row } : {}),
    ...(options.resource !== undefined ? { resource: options.resource } : {}),
    ...(options.filters ? { filters: options.filters } : {}),
  });
}
