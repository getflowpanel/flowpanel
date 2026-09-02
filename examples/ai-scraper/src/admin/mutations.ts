import type { BulkAction, RowAction } from "@flowpanel/kit";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { requireSandboxId } from "@/src/demo/sandbox/scope";
import { refundInvoice } from "@/src/lib/billing";
import { retryRun } from "@/src/lib/runner";

type Customer = typeof schema.customers.$inferSelect;
type Invoice = typeof schema.invoices.$inferSelect;
type Match = typeof schema.matches.$inferSelect;
type Monitor = typeof schema.monitors.$inferSelect;
type Run = typeof schema.runs.$inferSelect;

export const disableCustomer: RowAction<Customer>["run"] = async (row, _input, { db, scope }) => {
  await db
    .update(schema.customers)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(schema.customers.sandboxId, requireSandboxId(scope)), eq(schema.customers.id, row.id)),
    );
  return { ok: true, message: `Disabled ${row.email}`, refresh: true };
};

const setMonitorStatus =
  (status: "active" | "paused", verb: string): BulkAction<Monitor>["run"] =>
  async (ids, _input, { db, scope }) => {
    const numericIds = ids.map(Number).filter(Number.isFinite);
    await db
      .update(schema.monitors)
      .set({ status })
      .where(
        and(
          eq(schema.monitors.sandboxId, requireSandboxId(scope)),
          inArray(schema.monitors.id, numericIds),
        ),
      );
    return { ok: true, message: `${verb} ${ids.length}`, refresh: true };
  };

export const pauseMonitors = setMonitorStatus("paused", "Paused");
export const resumeMonitors = setMonitorStatus("active", "Resumed");

const reviewMatch =
  (status: "confirmed" | "rejected", message: string): RowAction<Match>["run"] =>
  async (row, _input, { db, actorId, scope }) => {
    await db
      .update(schema.matches)
      .set({ status, reviewedAt: new Date(), reviewedBy: actorId ?? "unknown" })
      .where(
        and(eq(schema.matches.sandboxId, requireSandboxId(scope)), eq(schema.matches.id, row.id)),
      );
    return { ok: true, message, refresh: true };
  };

export const confirmMatch = reviewMatch("confirmed", "Match confirmed");
export const rejectMatch = reviewMatch("rejected", "Match rejected");

export const retryFailedRun: RowAction<Run>["run"] = async (row, _input, { db, scope }) => {
  const sandboxId = requireSandboxId(scope);
  await retryRun(row.id, sandboxId);
  await db
    .update(schema.runs)
    .set({
      status: "queued",
      error: null,
      finishedAt: null,
      durationMs: null,
      pagesCrawled: 0,
      itemsExtracted: 0,
    })
    .where(and(eq(schema.runs.sandboxId, sandboxId), eq(schema.runs.id, row.id)));
  return { ok: true, message: "Run re-queued", refresh: true };
};

export const refundPaidInvoice: RowAction<Invoice, { reason: string }>["run"] = async (
  row,
  input,
  { db, scope },
) => {
  await refundInvoice(row.stripeId);
  await db
    .update(schema.invoices)
    .set({ status: "refunded" })
    .where(
      and(eq(schema.invoices.sandboxId, requireSandboxId(scope)), eq(schema.invoices.id, row.id)),
    );
  return { ok: true, message: `Invoice refunded: ${input.reason}`, refresh: true };
};
