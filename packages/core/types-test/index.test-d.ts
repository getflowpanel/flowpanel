// tsd type tests for @flowpanel/core public surface.
// These run against the built dist/index.d.ts — the actual contract.

import { expectAssignable, expectError, expectType } from "tsd";
import {
  type AdminConfig,
  type Adapter,
  defineAdmin,
  type LabelsConfig,
  type RealtimeConfig,
  type ResolvedAdminConfig,
  type ResourceConfig,
  metric,
  resource,
  table,
} from "@flowpanel/core";

// ── defineAdmin returns ResolvedAdminConfig ──────────────────────────────
declare const minimalConfig: AdminConfig;
expectType<ResolvedAdminConfig>(defineAdmin(minimalConfig));

// ── Adapter.kind is the discriminant union (I-2) ─────────────────────────
declare const adapter: Adapter;
expectAssignable<"drizzle" | "prisma">(adapter.kind);

// ── resource builder: produces ResourceConfig with __kind discriminant ───
declare const ref: unknown;
const r = resource(ref, { columns: ["id"] });
expectAssignable<ResourceConfig>(r);
expectAssignable<{ __kind: "resource" }>(r);

// ── metric builder produces a kind: "metric" widget ──────────────────────
const m = metric("Users", async () => 0);
expectAssignable<{ kind: "metric" }>(m);

// ── table widget accepts realtime as string | string[] ───────────────────
expectAssignable<{ kind: "table" }>(table({ resource: "users", realtime: "resource.users" }));
expectAssignable<{ kind: "table" }>(
  table({ resource: "users", realtime: ["resource.users", "audit.users"] }),
);

// ── LabelsConfig nesting + function-typed slot (I-12) ────────────────────
const validLabels: LabelsConfig = {
  actions: { save: "Сохранить" },
  bulkBar: { selected: (n: number) => `${n} выбрано` },
  pagination: { previous: "Назад" },
};
expectType<LabelsConfig>(validLabels);

// bulkBar.selected must be a function (not a string)
expectError<LabelsConfig>({ bulkBar: { selected: "string-not-fn" } });

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
