import { and, eq, gt, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import type { DemoSandboxConfig } from "./config";
import {
  assertCreationAllowed,
  canReset,
  nextDeadlines,
  SandboxCapacityError,
  SandboxCreationRateLimitError,
  SandboxResetRateLimitError,
  shouldTouch,
} from "./lifecycle";
import {
  cleanupExpiredSandboxes,
  databaseMaintenanceRepository,
  type MaintenanceEvent,
} from "./maintenance";
import { SEED_VERSION, seedSandboxInTransaction } from "./seed";

type Db = NodePgDatabase<typeof schema>;
type SandboxServiceEvent =
  | MaintenanceEvent
  | { event: "demo_sandbox_active_count"; active: number }
  | {
      event: "demo_sandbox_creation_rejected";
      reason: "capacity" | "fingerprint_rate_limit";
      active: number;
      recentForFingerprint: number;
    }
  | { event: "demo_sandbox_seed_failed"; errorName: string }
  | { event: "demo_sandbox_reset_failed"; errorName: string };

type EmitSandboxEvent = (event: SandboxServiceEvent) => void;

function emitSandboxEvent(event: SandboxServiceEvent): void {
  const message = JSON.stringify(event);
  if (event.event.endsWith("_failed")) {
    console.error(message);
  } else if (event.event === "demo_sandbox_creation_rejected") {
    console.warn(message);
  } else {
    console.info(message);
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Unknown";
}

export async function ensureSandbox({
  db,
  id,
  fingerprintHash,
  now,
  config,
  emit = emitSandboxEvent,
}: {
  db: Db;
  id: string;
  fingerprintHash: string | null;
  now: Date;
  config: DemoSandboxConfig;
  emit?: EmitSandboxEvent;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const seed = async (options?: Parameters<typeof seedSandboxInTransaction>[3]) => {
      try {
        await seedSandboxInTransaction(tx, id, now, options);
      } catch (error) {
        emit({ event: "demo_sandbox_seed_failed", errorName: errorName(error) });
        throw error;
      }
    };

    await cleanupExpiredSandboxes({
      repository: databaseMaintenanceRepository(tx),
      now,
      cleanupIntervalMs: config.cleanupIntervalMs,
      emit,
    });

    let [existing] = await tx
      .select()
      .from(schema.demoSandboxes)
      .where(eq(schema.demoSandboxes.id, id))
      .limit(1);

    if (existing && (existing.inactivityExpiresAt <= now || existing.absoluteExpiresAt <= now)) {
      await tx.delete(schema.demoSandboxes).where(eq(schema.demoSandboxes.id, id));
      existing = undefined;
    }

    if (existing) {
      if (existing.seedVersion !== SEED_VERSION) {
        await seed();
      } else if (shouldTouch(existing.lastSeenAt, now, config)) {
        await tx
          .update(schema.demoSandboxes)
          .set({
            lastSeenAt: now,
            inactivityExpiresAt: new Date(
              Math.min(now.getTime() + config.inactivityMs, existing.absoluteExpiresAt.getTime()),
            ),
          })
          .where(eq(schema.demoSandboxes.id, id));
      }
      return;
    }

    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('flowpanel-demo-create', 0))`,
    );
    [existing] = await tx
      .select()
      .from(schema.demoSandboxes)
      .where(eq(schema.demoSandboxes.id, id))
      .limit(1);
    if (existing) {
      await seed();
      return;
    }

    if (config.publicMode) {
      const [active] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.demoSandboxes)
        .where(
          and(
            gt(schema.demoSandboxes.inactivityExpiresAt, now),
            gt(schema.demoSandboxes.absoluteExpiresAt, now),
          ),
        );
      const [recent] = fingerprintHash
        ? await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(schema.demoSandboxes)
            .where(
              and(
                eq(schema.demoSandboxes.fingerprintHash, fingerprintHash),
                gt(schema.demoSandboxes.createdAt, new Date(now.getTime() - 60 * 60_000)),
              ),
            )
        : [{ count: config.maxCreatesPerHour }];
      const activeCount = active?.count ?? 0;
      const recentCount = recent?.count ?? 0;
      emit({ event: "demo_sandbox_active_count", active: activeCount });
      try {
        assertCreationAllowed({
          active: activeCount,
          recentForFingerprint: recentCount,
          config,
        });
      } catch (error) {
        const reason =
          error instanceof SandboxCapacityError
            ? "capacity"
            : error instanceof SandboxCreationRateLimitError
              ? "fingerprint_rate_limit"
              : null;
        if (reason) {
          emit({
            event: "demo_sandbox_creation_rejected",
            reason,
            active: activeCount,
            recentForFingerprint: recentCount,
          });
        }
        throw error;
      }
    }

    const deadlines = nextDeadlines(now, now, config);
    await tx.insert(schema.demoSandboxes).values({
      id,
      seedVersion: 0,
      createdAt: now,
      lastSeenAt: now,
      ...deadlines,
      fingerprintHash,
    });
    await seed();
  });
}

export async function resetCurrentSandbox({
  db,
  id,
  now,
  emit = emitSandboxEvent,
}: {
  db: Db;
  id: string;
  now: Date;
  emit?: EmitSandboxEvent;
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`);
      const [current] = await tx
        .select({ lastResetAt: schema.demoSandboxes.lastResetAt })
        .from(schema.demoSandboxes)
        .where(eq(schema.demoSandboxes.id, id))
        .limit(1);
      if (!current || !canReset(current.lastResetAt, now)) {
        throw new SandboxResetRateLimitError("Please wait a moment before resetting again.");
      }
      await seedSandboxInTransaction(tx, id, now, { force: true, markReset: true });
    });
  } catch (error) {
    if (!(error instanceof SandboxResetRateLimitError)) {
      emit({ event: "demo_sandbox_reset_failed", errorName: errorName(error) });
    }
    throw error;
  }
}
