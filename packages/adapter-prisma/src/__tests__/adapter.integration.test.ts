import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations } from "@flowpanel/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaAdapter } from "../../index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
type PrismaClientLike = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T[]>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  // biome-ignore lint/suspicious/noExplicitAny: test helper any cast
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
};

function pgToPrisma(pool: Pool): PrismaClientLike {
  return {
    $queryRawUnsafe: async <T>(sql: string, ...params: unknown[]) => {
      const result = await pool.query(sql, params);
      return result.rows as T[];
    },
    $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
      const result = await pool.query(sql, params);
      return result.rowCount ?? 0;
    },
    $transaction: async <T>(fn: (tx: PrismaClientLike) => Promise<T>) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txPrisma: PrismaClientLike = {
          $queryRawUnsafe: async <T2>(sql: string, ...params: unknown[]) => {
            const r = await client.query(sql, params);
            return r.rows as T2[];
          },
          $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
            const r = await client.query(sql, params);
            return r.rowCount ?? 0;
          },
          // biome-ignore lint/suspicious/noExplicitAny: recursive transaction helper
          $transaction: async (fn2: any) => fn2(txPrisma),
        };
        const result = await fn(txPrisma);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

const schema = `test_${Math.random().toString(36).slice(2)}`;
let pool: Pool;

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5433/flowpanel_test";
  pool = new Pool({
    host: "localhost",
    port: 5433,
    database: "flowpanel_test",
    user: "test",
    password: "test",
  });
  await pool.query(`CREATE SCHEMA ${schema}`);
  await pool.query(`SET search_path = ${schema}`);
});

afterAll(async () => {
  await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
});

describe("prismaAdapter integration", () => {
  it("connects and runs a query", async () => {
    const db = prismaAdapter({ prisma: pgToPrisma(pool) });
    const rows = await db.execute("SELECT 1 AS value", []);
    expect(rows[0]).toMatchObject({ value: 1 });
  });

  it("advisory lock round-trip", async () => {
    const db = prismaAdapter({ prisma: pgToPrisma(pool) });
    const key = BigInt("12345678");
    await db.advisoryLock(key);
    // Try to acquire the same lock from a second connection — should fail
    const pool2 = new Pool({
      host: "localhost",
      port: 5433,
      database: "flowpanel_test",
      user: "test",
      password: "test",
    });
    const db2 = prismaAdapter({ prisma: pgToPrisma(pool2) });
    const acquired = await db2.advisoryTryLock(key);
    expect(acquired).toBe(false);
    await db.advisoryUnlock(key);
    await pool2.end();
  });

  it("applyMigrations creates flowpanel tables", async () => {
    const db = prismaAdapter({ prisma: pgToPrisma(pool) });
    const migrationsDir = path.resolve(__dirname, "../../../../core/migrations");
    const { applied } = await applyMigrations(db, [migrationsDir]);
    expect(applied.length).toBeGreaterThanOrEqual(1);

    // Verify tables exist
    const tables = await db.execute<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = $1`,
      [schema],
    );
    const tableNames = tables.map((t) => t.tablename);
    expect(tableNames).toContain("flowpanel_meta");
    expect(tableNames).toContain("flowpanel_migrations");
  });

  it("applyMigrations is idempotent", async () => {
    const db = prismaAdapter({ prisma: pgToPrisma(pool) });
    const migrationsDir = path.resolve(__dirname, "../../../../core/migrations");
    const { applied: _firstApply } = await applyMigrations(db, [migrationsDir]);
    const { applied: secondApply } = await applyMigrations(db, [migrationsDir]);
    // Second run: nothing new to apply
    expect(secondApply.length).toBe(0);
  });
});
