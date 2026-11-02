import {
  type DetailHeaderContext,
  defineAdmin,
  type FormattingConfig,
  type LabelsConfig,
  type ResolvedAdminConfig,
  resource,
  type Session,
  type WidgetContext,
} from "@flowpanel/core";
import { adminWidgetContext } from "./admin-context";
import {
  columnsFrom,
  type MemorySource,
  memoryAdapter,
  type Row,
  type SqlAnswer,
} from "./memory-adapter";

export interface WidgetContextOptions {
  /** Rows per resource name. `ctx.count`, `ctx.read`, `compare` and count metrics read them. */
  rows?: Readonly<Record<string, readonly Row[]>>;
  /**
   * Your `defineAdmin` config, with only its database replaced by `rows`; carries no tenant scope.
   * Without `admin`, every key of `rows` is a resource whose columns are the keys its rows carry.
   */
  admin?: ResolvedAdminConfig;
  /** The viewed record, for a record-page widget: `ctx.row`, `ctx.id` and `ctx.rowOf`. */
  row?: Row;
  /** The resource `row` belongs to; `ctx.rowOf` of another name throws. */
  resource?: string;
  /** The picked period; `compare` reads the one before it. @defaultValue the whole history until now */
  range?: { from: Date; to: Date };
  /** The dashboard filters widgets read as `ctx.filters`. @defaultValue {} */
  filters?: Readonly<Record<string, string>>;
  /** Rows every `ctx.sql` returns, or a function given the statement (`$1…$n`) and its values. */
  sql?: SqlAnswer;
  /** Handed to widgets as `ctx.db`. @defaultValue null */
  db?: unknown;
  /** @defaultValue null */
  session?: Session | null;
  /** The role access checks compare. @defaultValue "admin" */
  role?: string;
  /** Without `admin`: locale, zone and currency, as `defineAdmin` takes them. */
  formatting?: FormattingConfig;
  /** Without `admin`: overrides of the admin's strings. */
  labels?: LabelsConfig;
  /** Without `admin`: where the admin is mounted, as `defineAdmin` takes `paths`. @defaultValue `{ admin: "/admin" }` */
  paths?: { admin?: string };
}

type Shared = Pick<MemorySource, "rows" | "sql" | "db">;

function stubAdmin(options: WidgetContextOptions, shared: Shared): ResolvedAdminConfig {
  const names = [
    ...new Set([...Object.keys(shared.rows), ...(options.resource ? [options.resource] : [])]),
  ];
  const own = (name: string): readonly Row[] => [
    ...(shared.rows[name] ?? []),
    ...(options.row && name === options.resource ? [options.row] : []),
  ];
  const nameOf = (ref: unknown) => (ref as { __name: string }).__name;
  return defineAdmin({
    adapter: memoryAdapter({
      ...shared,
      nameOf,
      columnsOf: (ref) => columnsFrom(own(nameOf(ref))),
    }),
    auth: {
      session: async () => options.session ?? null,
      role: () => options.role ?? "admin",
      allowUnauthenticated: true,
    },
    readOnly: true,
    paths: { admin: options.paths?.admin ?? "/admin" },
    ...(options.formatting ? { formatting: options.formatting } : {}),
    ...(options.labels ? { labels: options.labels } : {}),
    resources: names.map((name) =>
      resource({ __name: name }, { columns: columnsFrom(own(name)).map((column) => column.name) }),
    ),
  });
}

function overAdmin(admin: ResolvedAdminConfig, shared: Shared): ResolvedAdminConfig {
  const names = new Map(
    [...admin.resourcesByName].map(([name, entry]) => [entry.ref, name] as const),
  );
  const columnsOf = (ref: unknown) => {
    try {
      return admin.adapter.introspect(ref).columns;
    } catch {
      return [];
    }
  };
  const { scope: _scope, ...rest } = admin;
  return {
    ...rest,
    adapter: memoryAdapter({ ...shared, nameOf: (ref) => names.get(ref) ?? "", columnsOf }),
  };
}

/**
 * The context a widget receives in the admin, over rows you pass instead of a database.
 * Hand it to `resolveWidget`, or call a widget's query with it.
 */
export function widgetContext(options: WidgetContextOptions = {}): WidgetContext {
  const shared: Shared = {
    rows: options.rows ?? {},
    ...(options.sql !== undefined ? { sql: options.sql } : {}),
    ...(options.db !== undefined ? { db: options.db } : {}),
  };
  const config = options.admin ? overAdmin(options.admin, shared) : stubAdmin(options, shared);
  return adminWidgetContext(config, {
    ...(options.session !== undefined ? { session: options.session } : {}),
    ...(options.role !== undefined ? { role: options.role } : {}),
    ...(options.range ? { range: options.range } : {}),
    ...(options.row ? { row: options.row } : {}),
    ...(options.resource !== undefined ? { resource: options.resource } : {}),
    ...(options.filters ? { filters: options.filters } : {}),
  });
}

/** What a record page hands `detail.title`, `subtitle` and `badge`, for a test that calls them. */
export function headerContext(
  options: Pick<WidgetContextOptions, "admin" | "formatting" | "labels" | "paths"> = {},
): DetailHeaderContext {
  const { format, labels, link } = widgetContext(options);
  return { format, labels, link };
}
