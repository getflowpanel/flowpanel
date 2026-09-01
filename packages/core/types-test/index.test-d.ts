// tsd type tests for @flowpanel/core public surface.
// These run against the built dist/index.d.ts — the actual contract.

import {
  type Adapter,
  type AdapterKind,
  type AdminConfig,
  type BarChartOptions,
  type BoundAdapterScope,
  bindAdapterScope,
  custom,
  type DrawerConfig,
  type DrawerTabWidgets,
  defineAdmin,
  type InferRow,
  type LabelsConfig,
  metric,
  type PieChartOptions,
  type QueueOptions,
  type RealtimeConfig,
  type ResolvedAdminConfig,
  type ResourceConfig,
  type RowAction,
  resource,
  rowAction,
  type ShellConfig,
  statGroup,
  table,
  type WidgetContext,
} from "@flowpanel/core";
import {
  type MigrationSqlStatement,
  tokenizeMigrationSql,
} from "@flowpanel/core/internal/migration-sql";
import { expectAssignable, expectError, expectType } from "tsd";

declare module "@flowpanel/core" {
  interface FlowpanelResources {
    users: { id: number; email: string };
  }
}

// ── defineAdmin returns ResolvedAdminConfig ──────────────────────────────
declare const minimalConfig: AdminConfig;
expectType<ResolvedAdminConfig>(defineAdmin(minimalConfig));

// ── Adapter.kind is an open literal union (I-2, ADR 0016) ────────────────
declare const adapter: Adapter;
expectAssignable<string>(adapter.kind);
expectAssignable<AdapterKind>("drizzle");
expectAssignable<AdapterKind>("prisma");
// third-party adapters may name themselves
expectAssignable<AdapterKind>("mikro-orm");
expectType<BoundAdapterScope>(bindAdapterScope((query) => query));
expectAssignable<Adapter["applyMigration"]>(async (id, sql) => {
  expectType<string>(id);
  expectType<string>(sql);
});
expectType<MigrationSqlStatement[]>(tokenizeMigrationSql("SELECT 1;"));

// ── ShellConfig lets host layouts own the single skip link ──────────────
expectAssignable<ShellConfig>({ skipLink: false });
expectError<ShellConfig>({ skipLink: "false" });

// ── resource builder: produces ResourceConfig with __kind discriminant ───
declare const ref: unknown;
const r = resource(ref, { columns: ["id"] });
expectAssignable<ResourceConfig>(r);
expectAssignable<{ __kind: "resource" }>(r);

// ── InferRow<Ref> resolves string refs from augmented FlowpanelResources ──
expectType<{ id: number; email: string }>({} as InferRow<"users">);
expectType<Record<string, unknown>>({} as InferRow<"unknown_resource">);

// ── metric builder produces a kind: "metric" widget ──────────────────────
const m = metric("Users", async () => 0);
expectAssignable<{ kind: "metric" }>(m);

// ── table widget accepts realtime as string | string[] ───────────────────
expectAssignable<{ kind: "table" }>(table({ resource: "users", realtime: "resource.users" }));
expectAssignable<{ kind: "table" }>(
  table({ resource: "users", realtime: ["resource.users", "audit.users"] }),
);

// ── LabelsConfig nesting + string-template slot (I-12) ───────────────────
const validLabels: LabelsConfig = {
  actions: { save: "Сохранить" },
  bulkBar: { selected: "{n} выбрано" },
  pagination: { previous: "Назад" },
};
expectType<LabelsConfig>(validLabels);

// bulkBar.selected is a string template using {n}
expectAssignable<LabelsConfig>({ bulkBar: { selected: "{n} selected" } });

// ── RealtimeConfig is a discriminated union ──────────────────────────────
expectAssignable<RealtimeConfig>({ driver: "memory" });
expectAssignable<RealtimeConfig>({ driver: "redis", url: "redis://localhost:6379" });
expectAssignable<RealtimeConfig>({
  driver: "redis",
  url: "redis://localhost:6379",
  keyPrefix: "fp:",
});

// driver: "redis" requires url
expectError<RealtimeConfig>({ driver: "redis" });

// ── queues may stay routable while omitted from primary navigation ───────
expectAssignable<QueueOptions>({
  label: "Scrape",
  boardUrl: "http://localhost/scrape",
  hidden: true,
});

// ── drawer field lists are keyed to the row, like detail tabs ────────────
type User = { id: number; email: string };
expectAssignable<DrawerConfig<User>>({ fields: ["email"] });
expectAssignable<DrawerConfig<User>>({ fields: "*" });
expectAssignable<DrawerConfig<User>>({ tabs: [{ key: "p", label: "Profile", fields: ["email"] }] });
expectError<DrawerConfig<User>>({ fields: ["emial"] });
expectError<DrawerConfig<User>>({ tabs: [{ key: "p", label: "Profile", fields: ["emial"] }] });

// ── action forms describe their own payload, not properties of the row ──────
type SuspendInput = { reason: string; notify: boolean };
const suspend = rowAction<User, SuspendInput>({
  key: "suspend",
  label: "Suspend",
  icon: "ban",
  form: [
    { name: "reason", type: "textarea", required: true },
    { name: "notify", type: "checkbox" },
  ],
  run: async (user, input) => {
    expectType<User>(user);
    expectType<SuspendInput>(input);
    return { ok: true };
  },
});
expectType<RowAction<User, SuspendInput>>(suspend);
expectError<RowAction<User, SuspendInput>>({
  key: "bad",
  label: "Bad",
  form: [{ name: "typo", type: "text" }],
  run: async () => ({ ok: true }),
});

// stat resolver callbacks keep their WidgetContext instead of collapsing to implicit any
statGroup({
  stats: [
    {
      label: "Users",
      value: async (ctx) => {
        expectType<WidgetContext>(ctx);
        return 42;
      },
    },
  ],
});

// ── drawer widget tabs reject custom() widgets ───────────────────────────
expectAssignable<DrawerTabWidgets>({
  key: "w",
  label: "Activity",
  widgets: [metric("Users", async () => 0)],
});
expectError<DrawerTabWidgets>({
  key: "w",
  label: "Activity",
  widgets: [custom(() => null, {})],
});

// ── table columns and chart axes follow the query row ────────────────────
expectAssignable<{ kind: "table" }>(
  table({ query: async () => [{ id: 1, email: "a@b.c" }], columns: ["email"] }),
);
expectError(table({ query: async () => [{ id: 1, email: "a@b.c" }], columns: ["emial"] }));
// no query means no row type to check against — any column string is allowed
expectAssignable<{ kind: "table" }>(table({ resource: "users", columns: ["anything"] }));

expectAssignable<BarChartOptions<{ model: string; cost: number }>>({ x: "model", y: "cost" });
expectError<BarChartOptions<{ model: string; cost: number }>>({ x: "modle", y: "cost" });
expectError<BarChartOptions<{ model: string; cost: number }>>({ x: "model", y: ["cst"] });
expectError<PieChartOptions<{ status: string; count: number }>>({
  category: "staus",
  value: "count",
});
