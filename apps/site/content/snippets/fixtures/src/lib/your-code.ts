/**
 * The reader's own functions, components and enums the docs' examples call without defining them.
 * The docs checker imports a name from here when a block uses it and declares nothing by that name.
 */
import {
  type BarRow,
  enumOf,
  type FunnelStep,
  type funnel,
  type ListRow,
  type metric,
  type queue,
  type RequestContext,
  resource,
  type SectionConfig,
  type TimelineEvent,
  type WidgetContext,
  type WidgetDateRange,
  type WidgetFormat,
} from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import type { ReactNode } from "react";
import { db } from "@/db";
import * as schema from "@/db/schema";

type Db = typeof db;
type Row = Record<string, unknown>;

export const PLATFORMS = ["kwork", "fl", "upwork"] as const;
export const Platform = enumOf(PLATFORMS, { kwork: "Kwork", fl: "FL.ru", upwork: "Upwork" });
export const Plan = enumOf(["free", "starter", "pro", "business"], {
  free: ["Free", "muted"],
  starter: ["Starter", "info"],
  pro: ["Pro", "accent"],
  business: ["Business", "accent"],
});
export const Lifecycle = enumOf({
  new: "New",
  active: ["Active", "ok"],
  dormant: ["Dormant", "muted"],
});
export const Activity = enumOf({
  monitor: ["Monitor added", "info"],
  paid: ["Invoice paid", "ok"],
  signup: ["Signed up", "info"],
  note: "Note",
});
export const AccountStatus = enumOf(["active", "trialing", "past_due", "canceled"], {
  active: ["Active", "ok"],
  trialing: ["Trialing", "info"],
  past_due: ["Past due", "err"],
  canceled: ["Canceled", "muted"],
});
export const Bot = enumOf({ sent: ["Sent", "info"], failed: ["Failed", "err"] });
export const Visits = { one: "visit", other: "visits" };

export interface HourRow {
  at: Date;
  site: string;
  platform: string;
  runs: number;
  failed: number;
  orders: number;
}

export const Site = enumOf({ amazon: "Amazon", ebay: "eBay", walmart: "Walmart" });
export const RUN_ERRORS = { warn: 0.3, err: 0.5, min: 20 };

export declare function mrr(db: Db, range: WidgetDateRange): Promise<number>;
export declare function revenueSeries(
  db: Db,
): Promise<Array<{ day: string; subscriptions: number; "one-off": number }>>;
export declare function countPaid(db: Db, range: WidgetDateRange): Promise<number>;
export declare function countSignups(db: Db, range: WidgetDateRange): Promise<number>;
export declare function revenueCents(db: Db, range: WidgetDateRange): Promise<number>;
export declare function countTrials(db: Db): Promise<number>;
export declare function balance(db: Db): Promise<number>;
export declare function latencyStages(
  db: Db,
  range: WidgetDateRange,
): Promise<{ p50Ms: number; p95Ms: number; n: number }>;
export declare function runsToday(c: WidgetContext): Promise<number>;
export declare function consentShare(c: WidgetContext): Promise<number>;
export declare function lastRollupHour(c: WidgetContext): Promise<Date | null>;
export declare function runErrorRate(c: WidgetContext): Promise<{ rate: number; runs: number }>;
export declare function platforms(db: Db): Promise<Array<{ key: string; label: string }>>;
export declare function PlatformGrid(props: {
  platforms: Array<{ key: string; label: string; runsHref: string }>;
}): ReactNode;
export declare function planOf(row: Row | undefined): string;
export declare function joinedAt(row: Row | undefined): Date | null;
export declare function profileOf(
  c: WidgetContext,
): Promise<{ bio: string | null; hourlyRate: number | null; resumeText: string | null } | null>;
export declare function winRates(db: Db): Promise<BarRow[]>;
export declare function revenueByPlan(db: Db): Promise<BarRow[]>;
export declare function signupSteps(db: Db): Promise<FunnelStep[]>;
export declare function latestSignups(db: Db): Promise<ListRow[]>;
export declare function priorities(c: WidgetContext): Promise<ListRow[]>;
export declare function hourly(c: WidgetContext): Promise<HourRow[]>;
export declare function errorRate(rows: readonly HourRow[]): number;
export declare function platformHealth(c: WidgetContext): Promise<Map<string, Date>>;
export declare function lastSuccess(
  health: Map<string, Date>,
  key: string,
  format: WidgetFormat,
): string;
export declare function loadEvents(
  db: Db,
  id: string | undefined,
  page: { before: Date | null; limit: number },
): Promise<TimelineEvent[]>;
export declare function signupsByPlan(
  c: WidgetContext,
): Promise<Array<{ day: string; trial: number; paid: number }>>;

export declare const newOrders: ReturnType<typeof metric>;
export declare const runs: ReturnType<typeof metric>;
export declare const successRate: ReturnType<typeof metric>;
export declare const bans: ReturnType<typeof metric>;
export declare const responseFunnel: ReturnType<typeof funnel>;
export declare function findCategory(
  ctx: RequestContext,
  id: number | null,
): Promise<{ title: string; openJobs: number }>;
export declare function spendByMonth(db: Db, customerId: number): Promise<BarRow[]>;
export declare function suspendUser(db: Db, id: string, reason: string): Promise<void>;
export declare const sections: SectionConfig[];
export declare function AuditPage(): ReactNode;
export const boardUrl = "/admin/queues/board";
export declare const emailQueue: Parameters<typeof queue>[0];
export const adapter = drizzleAdapter({ db, schema });
export const resources = [resource(schema.customers, { columns: ["email", "plan"] })];
export declare function findCustomer(
  db: Db,
  id: number,
): Promise<{ id: number; email: string } | null>;
export declare function CopyId(props: { value: string }): ReactNode;
export declare function openOrders(c: WidgetContext): Promise<number>;
export declare function Pipeline(props: {
  stages: Array<{ label: string; count: number }>;
}): ReactNode;
export declare function pipelineProps(
  c: WidgetContext,
): Promise<{ stages: Array<{ label: string; count: number }> }>;
export { flowpanelAuth } from "@/server/lib/flowpanel-session";
export declare function refund(db: Db, id: number, reason: string): Promise<void>;
export declare const driver: {
  query(strings: TemplateStringsArray, values: unknown[]): Promise<Record<string, unknown>[]>;
};
export declare function retryFailed(): Promise<{ ok: true; message: string }>;
export declare function findDailySignups(
  db: Db,
  range: WidgetDateRange,
): Promise<Array<{ day: string; count: number }>>;
export declare function pipelineStages(
  c: WidgetContext,
): Promise<Array<{ label: string; count: number; tone: "ok" | "warn" | "err"; trend: number[] }>>;
export const STAGE_ROWS = [{ stage: "failed", count: 3 }];
