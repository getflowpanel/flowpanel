/** Cron entry point for the public demo. Exits non-zero so the platform alerts. */
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

const connectionString = process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/ai_scraper";

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
