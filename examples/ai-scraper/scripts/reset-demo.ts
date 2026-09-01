/** Operator entry point for restoring exactly one demo sandbox. */
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "../src/db/connection";
import * as schema from "../src/db/schema";
import { isPublicSandboxId } from "../src/demo/sandbox/identity";
import { RESET_DEMO_HELP } from "../src/demo/sandbox/script-help";
import { resetSandboxData } from "../src/demo/sandbox/seed";

function sandboxArg(args: string[]): string {
  const index = args.indexOf("--sandbox");
  const value = index < 0 ? "local" : args[index + 1];
  if (!value || (value !== "local" && !isPublicSandboxId(value))) {
    throw new Error("--sandbox must be local or a canonical public UUID");
  }
  return value;
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(RESET_DEMO_HELP);
    return;
  }
  const id = sandboxArg(process.argv.slice(2));
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  try {
    await resetSandboxData(drizzle(pool, { schema }), id, new Date());
    console.log(JSON.stringify({ ok: true, sandbox: id }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("reset-demo failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  });
}
