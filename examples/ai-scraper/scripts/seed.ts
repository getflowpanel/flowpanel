/**
 * Seed the demo database with realistic ai-scraper data.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 *
 * Seed and reset share the transactional sandbox service.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedSandbox } from "../src/demo/sandbox/seed";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/ai_scraper",
});
const db = drizzle(pool, { schema });

async function seed() {
  console.log("⏳ seeding…");
  await seedSandbox(db, "local", new Date());
  console.log("✅ seeded");
}

seed()
  .catch((err) => {
    console.error("seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
