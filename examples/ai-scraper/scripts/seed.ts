/**
 * Seed the demo database with realistic ai-scraper data.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 *
 * Seed and reset share the transactional sandbox service.
 */
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "../src/db/connection";
import * as schema from "../src/db/schema";
import { seedSandbox } from "../src/demo/sandbox/seed";

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const seeded = await seedSandbox(drizzle(pool, { schema }), "local", new Date());
    console.log(JSON.stringify({ ok: true, sandbox: "local", seeded }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("seed failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  });
}
