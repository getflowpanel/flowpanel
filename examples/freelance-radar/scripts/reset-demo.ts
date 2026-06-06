/**
 * Reset the public demo database back to a known-good seed state.
 *
 * Designed to run from cron on the host (Railway scheduled command, fly
 * machines, GitHub Actions cron, Coolify scheduled task, …):
 *
 *   DATABASE_URL=postgres://... pnpm exec tsx scripts/reset-demo.ts
 *
 * Idempotent: TRUNCATE … RESTART IDENTITY CASCADE before reseed, so the
 * resulting state matches the one shipped in `scripts/seed.ts`. Both share
 * `scripts/seed-data.ts`, so they can never drift. Safe to invoke as often
 * as you like — recommended cadence is every 30–60 min.
 *
 * Exits non-zero on any failure so the cron platform can alert.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedDatabase } from "./seed-data";

const HELP = `Reset the FlowPanel public demo database.

Usage:
  DATABASE_URL=postgres://... pnpm exec tsx scripts/reset-demo.ts [--help]

What it does:
  1. TRUNCATEs every demo table (RESTART IDENTITY CASCADE).
  2. Re-inserts the seed rows from scripts/seed-data.ts.

Environment:
  DATABASE_URL   Required in production. Falls back to the local
                 docker-compose URL when unset.`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const connectionString =
  process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/freelance_radar";

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function reset() {
  console.log("⏳ resetting demo database…");
  await seedDatabase(db);
  console.log("✅ demo database reset");
}

reset()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("reset-demo failed:", err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
