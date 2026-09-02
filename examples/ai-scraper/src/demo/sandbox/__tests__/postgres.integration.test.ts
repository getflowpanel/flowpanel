import { inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { databaseUrl } from "../../../db/connection";
import * as schema from "../../../db/schema";
import { readSandboxConfig } from "../config";
import { SandboxCapacityError, SandboxCreationRateLimitError } from "../lifecycle";
import { cleanupExpiredSandboxes, databaseMaintenanceRepository } from "../maintenance";
import { ensureSandbox } from "../service";

const enabled = process.env.DEMO_POSTGRES_INTEGRATION === "1";
const baseConfig = readSandboxConfig({});
const publicConfig = {
  ...baseConfig,
  publicMode: true,
  secret: "integration-secret-that-is-longer-than-32-characters",
  maxActive: 10_000,
  maxCreatesPerHour: 1_000,
};

const ids = {
  concurrent: "11111111-1111-4111-8111-111111111111",
  rollback: "22222222-2222-4222-8222-222222222222",
  expired: "33333333-3333-4333-8333-333333333333",
  live: "44444444-4444-4444-8444-444444444444",
  capacityAnchor: "55555555-5555-4555-8555-555555555555",
  capacityRejected: "66666666-6666-4666-8666-666666666666",
  rateAnchor: "77777777-7777-4777-8777-777777777777",
  rateRejected: "88888888-8888-4888-8888-888888888888",
} as const;

const ownedTables = [
  "customers",
  "monitors",
  "runs",
  "products",
  "listings",
  "matches",
  "invoices",
  "ai_usage",
] as const;

let pool: Pool;
let db: NodePgDatabase<typeof schema>;

async function deleteTestSandboxes() {
  await pool.query("delete from demo_sandboxes where id = any($1::text[])", [Object.values(ids)]);
}

async function countRows(table: (typeof ownedTables)[number] | "demo_sandboxes", id: string) {
  const result = await pool.query<{ count: number }>(
    `select count(*)::int as count from ${table} where ${table === "demo_sandboxes" ? "id" : "sandbox_id"} = $1`,
    [id],
  );
  return result.rows[0]?.count ?? 0;
}

async function insertActiveSandbox(id: string, fingerprintHash: string, now: Date) {
  await pool.query(
    `insert into demo_sandboxes
      (id, seed_version, created_at, last_seen_at, inactivity_expires_at, absolute_expires_at, fingerprint_hash)
     values ($1, 1, $2, $2, $3, $4, $5)`,
    [
      id,
      now,
      new Date(now.getTime() + 60 * 60_000),
      new Date(now.getTime() + 24 * 60 * 60_000),
      fingerprintHash,
    ],
  );
}

describe.skipIf(!enabled)("demo sandbox lifecycle — PostgreSQL", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    db = drizzle(pool, { schema });
    await deleteTestSandboxes();
    await pool.query("drop trigger if exists flowpanel_test_fail_demo_seed on products");
    await pool.query("drop function if exists flowpanel_test_fail_demo_seed() cascade");
    await pool.query(`
      create function flowpanel_test_fail_demo_seed() returns trigger as $$
      begin
        if new.sandbox_id = '${ids.rollback}' then
          raise exception 'flowpanel injected seed failure after parent inserts';
        end if;
        return new;
      end;
      $$ language plpgsql
    `);
    await pool.query(`
      create trigger flowpanel_test_fail_demo_seed
      before insert on products
      for each row execute function flowpanel_test_fail_demo_seed()
    `);
  });

  afterEach(async () => deleteTestSandboxes());

  afterAll(async () => {
    if (!pool) return;
    await deleteTestSandboxes();
    await pool.query("drop trigger if exists flowpanel_test_fail_demo_seed on products");
    await pool.query("drop function if exists flowpanel_test_fail_demo_seed()");
    await pool.end();
  });

  it("serializes concurrent first access into one complete seed", async () => {
    const now = new Date();
    const create = () =>
      ensureSandbox({
        db,
        id: ids.concurrent,
        fingerprintHash: "a".repeat(64),
        now,
        config: publicConfig,
        emit: () => undefined,
      });

    await expect(Promise.all([create(), create()])).resolves.toEqual([undefined, undefined]);
    expect(await countRows("demo_sandboxes", ids.concurrent)).toBe(1);
    await expect(
      Promise.all(ownedTables.map((table) => countRows(table, ids.concurrent))),
    ).resolves.toEqual([48, 36, 252, 60, 240, 240, 144, 252]);
  }, 30_000);

  it("rolls back the sandbox and every earlier insert when a later table fails", async () => {
    await expect(
      ensureSandbox({
        db,
        id: ids.rollback,
        fingerprintHash: "b".repeat(64),
        now: new Date(),
        config: publicConfig,
        emit: () => undefined,
      }),
    ).rejects.toThrow();

    expect(await countRows("demo_sandboxes", ids.rollback)).toBe(0);
    await expect(
      Promise.all(ownedTables.map((table) => countRows(table, ids.rollback))),
    ).resolves.toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  }, 30_000);

  it("deletes expired ownership graphs by cascade and leaves active ownership intact", async () => {
    const now = new Date();
    const rollback = new Error("rollback cleanup test");

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(schema.demoSandboxes).values([
          {
            id: ids.expired,
            seedVersion: 1,
            createdAt: new Date(now.getTime() - 2 * 60 * 60_000),
            lastSeenAt: new Date(now.getTime() - 2 * 60 * 60_000),
            inactivityExpiresAt: new Date(now.getTime() - 1),
            absoluteExpiresAt: new Date(now.getTime() + 60 * 60_000),
            fingerprintHash: "c".repeat(64),
          },
          {
            id: ids.live,
            seedVersion: 1,
            createdAt: now,
            lastSeenAt: now,
            inactivityExpiresAt: new Date(now.getTime() + 60 * 60_000),
            absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
            fingerprintHash: "d".repeat(64),
          },
        ]);
        await tx.insert(schema.customers).values([
          { sandboxId: ids.expired, seedKey: 1, email: "expired@test.invalid" },
          { sandboxId: ids.live, seedKey: 1, email: "live@test.invalid" },
        ]);

        await cleanupExpiredSandboxes({
          repository: databaseMaintenanceRepository(tx),
          now,
          cleanupIntervalMs: publicConfig.cleanupIntervalMs,
          force: true,
        });

        const remainingSandboxes = await tx
          .select({ id: schema.demoSandboxes.id })
          .from(schema.demoSandboxes)
          .where(inArray(schema.demoSandboxes.id, [ids.expired, ids.live]));
        const remainingCustomers = await tx
          .select({ sandboxId: schema.customers.sandboxId })
          .from(schema.customers)
          .where(inArray(schema.customers.sandboxId, [ids.expired, ids.live]));
        expect(remainingSandboxes).toEqual([{ id: ids.live }]);
        expect(remainingCustomers).toEqual([{ sandboxId: ids.live }]);
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("rejects a new sandbox at the database-backed active-capacity boundary", async () => {
    const now = new Date();
    await insertActiveSandbox(ids.capacityAnchor, "e".repeat(64), now);
    const active = await pool.query<{ count: number }>(
      `select count(*)::int as count from demo_sandboxes
       where inactivity_expires_at > $1 and absolute_expires_at > $1`,
      [now],
    );

    await expect(
      ensureSandbox({
        db,
        id: ids.capacityRejected,
        fingerprintHash: "f".repeat(64),
        now,
        config: { ...publicConfig, maxActive: active.rows[0]?.count ?? 1 },
        emit: () => undefined,
      }),
    ).rejects.toBeInstanceOf(SandboxCapacityError);
    expect(await countRows("demo_sandboxes", ids.capacityRejected)).toBe(0);
  });

  it("rejects a second recent sandbox for the same database-backed fingerprint", async () => {
    const now = new Date();
    const fingerprint = "1".repeat(64);
    await insertActiveSandbox(ids.rateAnchor, fingerprint, now);

    await expect(
      ensureSandbox({
        db,
        id: ids.rateRejected,
        fingerprintHash: fingerprint,
        now,
        config: { ...publicConfig, maxCreatesPerHour: 1 },
        emit: () => undefined,
      }),
    ).rejects.toBeInstanceOf(SandboxCreationRateLimitError);
    expect(await countRows("demo_sandboxes", ids.rateRejected)).toBe(0);
  });
});
