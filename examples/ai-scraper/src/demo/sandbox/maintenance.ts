import { and, eq, lt, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";

export interface MaintenanceRepository {
  claim(now: Date, cleanupIntervalMs: number, force?: boolean): Promise<boolean>;
  deleteExpired(now: Date): Promise<number>;
  approximateRows(): Promise<number>;
}

export type MaintenanceEvent = {
  event: "demo_sandbox_cleanup";
  deleted: number;
  approximateRows: number;
};

export async function cleanupExpiredSandboxes({
  repository,
  now,
  cleanupIntervalMs,
  force = false,
  emit,
}: {
  repository: MaintenanceRepository;
  now: Date;
  cleanupIntervalMs: number;
  force?: boolean;
  emit?: (event: MaintenanceEvent) => void;
}): Promise<
  { claimed: false; deleted: 0 } | { claimed: true; deleted: number; approximateRows: number }
> {
  const claimed = await repository.claim(now, cleanupIntervalMs, force);
  if (!claimed) return { claimed: false, deleted: 0 };
  const deleted = await repository.deleteExpired(now);
  const approximateRows = await repository.approximateRows();
  emit?.({ event: "demo_sandbox_cleanup", deleted, approximateRows });
  return { claimed: true, deleted, approximateRows };
}

type Db = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function databaseMaintenanceRepository(database: Transaction): MaintenanceRepository {
  return {
    async claim(now, cleanupIntervalMs, force = false) {
      if (force) {
        await database.execute(
          sql`select pg_advisory_xact_lock(hashtextextended('flowpanel-demo-maintenance', 0))`,
        );
      } else {
        const lock = await database.execute<{ acquired: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtextextended('flowpanel-demo-maintenance', 0)) as acquired`,
        );
        if (!lock.rows[0]?.acquired) return false;
      }
      await database
        .insert(schema.demoMaintenance)
        .values({ id: 1, lastCleanupAt: new Date(0) })
        .onConflictDoNothing({ target: schema.demoMaintenance.id });
      const due = force
        ? eq(schema.demoMaintenance.id, 1)
        : and(
            eq(schema.demoMaintenance.id, 1),
            lt(schema.demoMaintenance.lastCleanupAt, new Date(now.getTime() - cleanupIntervalMs)),
          );
      const claimed = await database
        .update(schema.demoMaintenance)
        .set({ lastCleanupAt: now })
        .where(due)
        .returning({ id: schema.demoMaintenance.id });
      return claimed.length === 1;
    },
    async deleteExpired(now) {
      const deleted = await database
        .delete(schema.demoSandboxes)
        .where(
          or(
            lte(schema.demoSandboxes.inactivityExpiresAt, now),
            lte(schema.demoSandboxes.absoluteExpiresAt, now),
          ),
        )
        .returning({ id: schema.demoSandboxes.id });
      return deleted.length;
    },
    async approximateRows() {
      const result = await database.execute<{ approximateRows: string }>(sql`
        select coalesce(sum(n_live_tup), 0)::text as "approximateRows"
        from pg_stat_user_tables
        where schemaname = current_schema()
          and relname in (
            'demo_sandboxes', 'customers', 'monitors', 'runs', 'products',
            'listings', 'matches', 'invoices', 'ai_usage'
          )
      `);
      return Number(result.rows[0]?.approximateRows ?? 0);
    },
  };
}

export async function cleanupExpiredSandboxesInDatabase({
  db,
  now,
  cleanupIntervalMs,
  force = false,
}: {
  db: Db;
  now: Date;
  cleanupIntervalMs: number;
  force?: boolean;
}) {
  return db.transaction((tx) =>
    cleanupExpiredSandboxes({
      repository: databaseMaintenanceRepository(tx),
      now,
      cleanupIntervalMs,
      force,
    }),
  );
}
