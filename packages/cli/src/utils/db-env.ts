import * as fs from "node:fs/promises";
import { findAdminConfig } from "../scaffold/config-target";
import { resolveProjectModule } from "./module-path";
import { findPrismaSchemaFiles } from "./prisma-provider";
import type { SqlDialect } from "./sql-dialect";

const ENV_READ =
  /\bprocess\.env\.([A-Za-z_]\w*)|\bprocess\.env\[\s*["'](\w+)["']\s*\]|\benv\.([A-Z][A-Z0-9_]*)\b|\benv\(\s*["'](\w+)["']\s*\)/g;
const CONNECTION_NAME = /URL|URI|DSN|CONNECTION/i;
const NOT_DATABASE = /REDIS|KV|BOARD|PUBLIC|AUTH|APP_URL/i;
const LITERAL_FALLBACK = /^\s*!?\s*(?:\?\?|\|\|)(?!\s*(?:process\.env\b|env[.(]))/;
const DB_IMPORT =
  /import\s+(?:\{[^}]*\b(?:db|prisma)\b[^}]*\}|(?:db|prisma)(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+(?:db|prisma))\s+from\s+["']([^"']+)["']/g;

/** Database connection variables a source reads with no literal fallback, e.g. `DATABASE_URL`. */
export function connectionEnvNames(source: string): string[] {
  const names = new Set<string>();
  const fallback = new Set<string>();
  for (const match of source.matchAll(ENV_READ)) {
    const name = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (!name || !CONNECTION_NAME.test(name) || NOT_DATABASE.test(name)) continue;
    const rest = source.slice(match.index + match[0].length);
    (LITERAL_FALLBACK.test(rest) ? fallback : names).add(name);
  }
  return [...names].filter((name) => !fallback.has(name));
}

/**
 * Why `migrate` must not connect yet: the database client would read an unset or empty URL, and
 * drivers then fall back to their defaults (pg: localhost:5432), which can be another database.
 */
export async function missingConnectionEnv(
  cwd: string,
  dialect: SqlDialect | null,
  migrateCommand: string,
): Promise<string | null> {
  const config = await findAdminConfig(cwd);
  const sources: string[] = [];
  if (config) {
    const source = await fs.readFile(config.file, "utf8").catch(() => "");
    for (const match of source.matchAll(DB_IMPORT)) {
      const file = await resolveProjectModule(cwd, match[1] ?? "", config.file);
      if (file) sources.push(await fs.readFile(file, "utf8").catch(() => ""));
    }
    if (/\bprismaAdapter\s*\(/.test(source)) {
      for (const file of await findPrismaSchemaFiles(cwd)) {
        sources.push(await fs.readFile(file, "utf8").catch(() => ""));
      }
    }
  }
  const read = [...new Set(sources.flatMap(connectionEnvNames))];
  const empty = read.every((name) => !process.env[name]?.trim()) ? read[0] : undefined;
  if (empty === undefined) return null;
  const example =
    dialect === "mysql"
      ? "mysql://user:password@host:3306/db"
      : dialect === "sqlite"
        ? "file:./local.db"
        : "postgres://user:password@host:5432/db";
  const state = process.env[empty] === undefined ? "not set" : "empty";
  return `${empty} is ${state}, so the database client would connect to its driver's default instead of your database. Add ${empty}=${example} to .env.local, or pass it inline: ${empty}=… ${migrateCommand}`;
}
