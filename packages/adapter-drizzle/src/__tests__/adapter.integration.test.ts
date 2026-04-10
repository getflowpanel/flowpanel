import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { applyMigrations } from "@flowpanel/core";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter } from "../../index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create a minimal Drizzle-like db from pg Pool for testing
function pgToDb(pool: Pool) {
	return {
		execute: async ({ sql, params }: { sql: string; params: unknown[] }) => {
			// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
			const result = await pool.query(sql, params as any[]);
			return result.rows;
		},
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		transaction: async (fn: any) => {
			const client = await pool.connect();
			try {
				await client.query("BEGIN");
				const txDb = {
					// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
					execute: async ({ sql, params }: any) => {
						const r = await client.query(sql, params);
						return r.rows;
					},
					// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
					transaction: async (fn2: any) => fn2(txDb),
				};
				const result = await fn(txDb);
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

describe("drizzleAdapter integration", () => {
	it("connects and runs a query", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		const db = drizzleAdapter({ db: pgToDb(pool) as any });
		const rows = await db.execute("SELECT 1 AS value", []);
		expect(rows[0]).toMatchObject({ value: 1 });
	});

	it("advisory lock round-trip", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		const db = drizzleAdapter({ db: pgToDb(pool) as any });
		const key = BigInt("12345678");
		await db.advisoryLock(key);
		// Verify lock held — try from another connection should fail
		const pool2 = new Pool({
			host: "localhost",
			port: 5433,
			database: "flowpanel_test",
			user: "test",
			password: "test",
		});
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		const db2 = drizzleAdapter({ db: pgToDb(pool2) as any });
		const acquired = await db2.advisoryTryLock(key);
		expect(acquired).toBe(false);
		await db.advisoryUnlock(key);
		await pool2.end();
	});

	it("applyMigrations creates flowpanel tables", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		const db = drizzleAdapter({ db: pgToDb(pool) as any });
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
		// biome-ignore lint/suspicious/noExplicitAny: test helper any cast
		const db = drizzleAdapter({ db: pgToDb(pool) as any });
		const migrationsDir = path.resolve(__dirname, "../../../../core/migrations");
		const { applied: firstApply } = await applyMigrations(db, [migrationsDir]);
		const { applied: secondApply } = await applyMigrations(db, [migrationsDir]);
		// Second run: nothing new to apply
		expect(secondApply.length).toBe(0);
	});
});
