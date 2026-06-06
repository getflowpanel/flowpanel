/**
 * Seed the demo database with realistic freelance-radar data.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 *
 * The actual data lives in `scripts/seed-data.ts` so `scripts/reset-demo.ts`
 * can reuse it without copy-paste.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { seedDatabase } from "./seed-data";

const db = drizzle(
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/freelance_radar",
  }),
  { schema },
);

async function seed() {
  console.log("⏳ seeding…");
  await seedDatabase(db);
  console.log("✅ seeded");
  process.exit(0);
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
