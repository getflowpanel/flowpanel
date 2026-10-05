import * as fs from "node:fs/promises";
import { findAdminConfig } from "../scaffold/config-target";
import { resolveProjectModule } from "./module-path";

export type SqlDialect = "postgresql" | "mysql" | "sqlite";

const DRIZZLE_MODULES: ReadonlyArray<readonly [RegExp, SqlDialect]> = [
  [
    /^(?:pg-core|node-postgres|postgres-js|neon-http|neon-serverless|vercel-postgres|pglite|pg-proxy|xata-http|aws-data-api\/pg)$/,
    "postgresql",
  ],
  [/^(?:mysql-core|mysql2|planetscale-serverless|tidb-serverless|mysql-proxy)$/, "mysql"],
  [
    /^(?:sqlite-core|better-sqlite3|libsql(?:\/.*)?|bun-sqlite|d1|expo-sqlite|op-sqlite|sql-js|sqlite-proxy|durable-sqlite)$/,
    "sqlite",
  ],
];

const DRIZZLE_IMPORT = /from\s+["']drizzle-orm\/([\w/-]+)["']/g;

/** The dialect a Drizzle schema or client source imports, or `null` when it names none. */
export function drizzleDialectOf(source: string): SqlDialect | null {
  for (const match of source.matchAll(DRIZZLE_IMPORT)) {
    const found = DRIZZLE_MODULES.find(([pattern]) => pattern.test(match[1] ?? ""));
    if (found) return found[1];
  }
  return null;
}

export function migrationTemplate(dialect: SqlDialect): string {
  return `migration.${dialect}.sql.txt`;
}

/** The dialect of the first of `specifiers` that resolves and imports a Drizzle driver or core module. */
export async function drizzleDialectFrom(
  cwd: string,
  specifiers: readonly string[],
  fromFile?: string,
): Promise<SqlDialect | null> {
  for (const specifier of specifiers) {
    const file = await resolveProjectModule(cwd, specifier, fromFile);
    if (!file) continue;
    const dialect = drizzleDialectOf(await fs.readFile(file, "utf8").catch(() => ""));
    if (dialect) return dialect;
  }
  return null;
}

const DRIVER_PACKAGES: ReadonlyArray<readonly [string, SqlDialect]> = [
  ["pg", "postgresql"],
  ["postgres", "postgresql"],
  ["@neondatabase/serverless", "postgresql"],
  ["@vercel/postgres", "postgresql"],
  ["@electric-sql/pglite", "postgresql"],
  ["mysql2", "mysql"],
  ["@planetscale/database", "mysql"],
  ["better-sqlite3", "sqlite"],
  ["@libsql/client", "sqlite"],
];

/** The dialect of the one database driver package.json declares, or `null` with none or several. */
export function dialectFromDependencies(deps: Readonly<Record<string, string>>): SqlDialect | null {
  const found = new Set(DRIVER_PACKAGES.filter(([name]) => name in deps).map(([, d]) => d));
  return found.size === 1 ? ([...found][0] ?? null) : null;
}

const PRISMA_PROVIDER =
  /\bprismaAdapter\s*\([^)]*\bprovider\s*:\s*["'](postgresql|mysql|sqlite)["']/;
const MODULE_IMPORT =
  /import\s+(?:\*\s+as\s+schema|\{[^}]*\bdb\b[^}]*\})\s+from\s+["']([^"']+)["']/g;

/** The dialect of an initialised project, read from its config without evaluating it. */
export async function configDialect(cwd: string): Promise<SqlDialect | null> {
  const config = await findAdminConfig(cwd);
  if (!config) return null;
  const source = await fs.readFile(config.file, "utf8");
  const provider = PRISMA_PROVIDER.exec(source)?.[1];
  if (provider === "postgresql" || provider === "mysql" || provider === "sqlite") return provider;
  const specifiers = [...source.matchAll(MODULE_IMPORT)].map((match) => match[1] ?? "");
  return drizzleDialectFrom(cwd, specifiers, config.file);
}
