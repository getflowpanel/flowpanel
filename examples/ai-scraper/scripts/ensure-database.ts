import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { databaseUrl } from "../src/db/connection";

// CREATE DATABASE cannot run inside a transaction or IF NOT EXISTS, so a
// concurrent boot can race us to it; 42P04 (duplicate_database) means it won.
async function ensureDatabase() {
  const target = new URL(databaseUrl);
  const database = target.pathname.slice(1) || "postgres";
  if (database === "postgres") return { database, created: false };

  const maintenance = new URL(databaseUrl);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (existing.rowCount) return { database, created: false };
    await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    return { database, created: true };
  } catch (error) {
    if ((error as { code?: string }).code === "42P04") return { database, created: false };
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  const result = await ensureDatabase();
  console.log(JSON.stringify({ ok: true, ...result }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(JSON.stringify({ ok: false, error: String(error) }));
    process.exitCode = 1;
  });
}
