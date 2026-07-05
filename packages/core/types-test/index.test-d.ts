// tsd type tests for @flowpanel/core public surface.
// These run against the built dist/index.d.ts — the actual contract.

import {
  type Adapter,
  type AdminConfig,
  defineAdmin,
  type InferRow,
  type LabelsConfig,
  metric,
  type RealtimeConfig,
  type ResolvedAdminConfig,
  type ResourceConfig,
  resource,
  table,
} from "@flowpanel/core";
import { expectAssignable, expectError, expectType } from "tsd";

declare module "@flowpanel/core" {
  interface FlowpanelResources {
    users: { id: number; email: string };
  }
}

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
