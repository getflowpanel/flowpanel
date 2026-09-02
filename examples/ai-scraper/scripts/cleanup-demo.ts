import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "../src/db/connection";
import * as schema from "../src/db/schema";
import { readSandboxConfig } from "../src/demo/sandbox/config";
import { cleanupExpiredSandboxesInDatabase } from "../src/demo/sandbox/maintenance";
import { CLEANUP_DEMO_HELP } from "../src/demo/sandbox/script-help";

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(CLEANUP_DEMO_HELP);
    return;
  }
  const config = readSandboxConfig();
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  try {
    const result = await cleanupExpiredSandboxesInDatabase({
      db: drizzle(pool, { schema }),
      now: new Date(),
      cleanupIntervalMs: config.cleanupIntervalMs,
      force: process.argv.includes("--force"),
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("cleanup-demo failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  });
}
