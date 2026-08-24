import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { BASE_DATABASE_URL, E2E_DATABASE_URL, E2E_DB_NAME, withDatabase } from "./e2e-db.js";

export default async function globalSetup(): Promise<void> {
  const admin = new Client({ connectionString: withDatabase(BASE_DATABASE_URL, "postgres") });
  await admin.connect();
  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [E2E_DB_NAME],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${E2E_DB_NAME}`);
    await admin.query(`CREATE DATABASE ${E2E_DB_NAME}`);
  } finally {
    await admin.end();
  }

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  execFileSync("pnpm", ["--filter", "ai-scraper", "db:push"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["--filter", "ai-scraper", "db:seed"], {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  });
}
