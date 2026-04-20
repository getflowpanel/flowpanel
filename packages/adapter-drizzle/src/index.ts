import type { SqlExecutor, SqlQuery, ResourceAdapter } from "@flowpanel/core";
import { extractModelFromDrizzleTable } from "./metadata";
import { createDrizzleResourceAdapter } from "./resource";
import type { ModelMetadata } from "@flowpanel/core";

// Re-export for library consumers
export { extractModelFromDrizzleTable } from "./metadata";
export { normalizedFiltersToDrizzleWhere } from "./filters";
export { createDrizzleResourceAdapter } from "./resource";

// biome-ignore lint/suspicious/noExplicitAny: Drizzle db type is opaque across versions
type DrizzleDatabaseLike = any;

type DrizzleDb = {
  execute: (query: { sql: string; params: unknown[] }) => Promise<unknown[]>;
};

/**
 * Create a Drizzle adapter for FlowPanel.
 *
 * Returns both a SqlExecutor (for raw SQL queries) and a ResourceAdapter
 * (for resource CRUD operations).
 *
 * @example
 * ```ts
 * const { sql, resource } = drizzleAdapter({
 *   db,
 *   schema,
 *   models: {
 *     User: { table: schema.users, modelName: "User" },
 *     Post: { table: schema.posts, modelName: "Post" },
 *   },
 * });
 * ```
 */
export function drizzleAdapter(opts: {
  db: DrizzleDatabaseLike | (() => Promise<DrizzleDatabaseLike>);
  dialect?: "postgres" | "sqlite";
  /**
   * Drizzle schema containing tables and relations.
   * Needed for relational queries (db.query.x.findMany with `with:`).
   */
  schema?: Record<string, unknown>;
  /**
   * Map of model name to table object + optional model name override.
   * If provided, enables the ResourceAdapter.
   *
   * @example
   * { User: { table: schema.users }, Post: { table: schema.posts } }
   */
  models?: Record<string, { table: unknown; modelName?: string }>;
  /**
   * Map of enum name to enum values.
   * If not provided, enum values are inferred from column definitions.
   */
  enums?: Record<string, string[]>;
}): {
  sql: SqlExecutor;
  resource: ResourceAdapter;
} {
  const dialect = opts.dialect ?? "postgres";
  let resolvedDb: DrizzleDb | null = null;

  async function getDb(): Promise<DrizzleDb> {
    if (!resolvedDb) {
      resolvedDb = typeof opts.db === "function" ? await opts.db() : opts.db;
    }
    return resolvedDb as DrizzleDb;
  }

  // Build metadata map
  const tablesMap = new Map<string, { table: unknown; metadata: ModelMetadata }>();
  for (const [key, entry] of Object.entries(opts.models ?? {})) {
    const modelName = entry.modelName ?? key;
    const metadata = extractModelFromDrizzleTable(modelName, entry.table);
    tablesMap.set(modelName, { table: entry.table, metadata });
  }

  // Build enums map
  const enumsMap = new Map<string, string[]>();
  for (const [name, values] of Object.entries(opts.enums ?? {})) {
    enumsMap.set(name, values);
  }

  // Also collect enums from column definitions
  for (const { metadata } of tablesMap.values()) {
    for (const field of metadata.fields) {
      if (field.kind === "enum" && field.enumValues && field.type === "enum") {
        // Store by field name as a fallback enum name if not already registered
        const enumKey = field.name;
        if (!enumsMap.has(enumKey)) {
          enumsMap.set(enumKey, field.enumValues);
        }
      }
    }
  }

  const resource = createDrizzleResourceAdapter(getDb, tablesMap, enumsMap);

  const sql: SqlExecutor = {
    dialect,
    async execute<T = Record<string, unknown>>(sqlText: string, params: unknown[]): Promise<T[]> {
      const db = await getDb();
      // Drizzle expects prepare: false for PgBouncer compatibility
      const result = (await db.execute({ sql: sqlText, params })) as T[];
      return result;
    },

    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const db = await getDb();
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle db cast for transaction API
      const drizzleWithTx = db as any;
      if (typeof drizzleWithTx.transaction === "function") {
        return drizzleWithTx.transaction(async (tx: DrizzleDb) => {
          const txResult = drizzleAdapter({
            db: tx,
            dialect,
            models: opts.models,
            enums: opts.enums,
          });
          return fn(txResult.sql);
        });
      }
      // Fallback: execute without transaction (warn)
      console.warn("[flowpanel] drizzleAdapter: transaction not available, executing without tx");
      return fn(sql);
    },

    async advisoryLock(key: bigint): Promise<void> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      await sql.execute(`SELECT pg_advisory_lock($1)`, [key.toString()]);
    },

    async advisoryUnlock(key: bigint): Promise<void> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      await sql.execute(`SELECT pg_advisory_unlock($1)`, [key.toString()]);
    },

    async advisoryTryLock(key: bigint): Promise<boolean> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      const rows = await sql.execute<{ pg_try_advisory_lock: boolean }>(
        `SELECT pg_try_advisory_lock($1)`,
        [key.toString()],
      );
      return rows[0]?.pg_try_advisory_lock ?? false;
    },

    sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
      let text = "";
      let paramIndex = 1;
      const paramValues: unknown[] = [];
      for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < values.length) {
          text += `$${paramIndex++}`;
          paramValues.push(values[i]);
        }
      }
      return { text, values: paramValues };
    },
  };

  return { sql, resource };
}
