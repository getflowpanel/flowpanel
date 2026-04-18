import type { SqlExecutor, SqlQuery } from "@flowpanel/core";

type DrizzleDb = {
  execute: (query: { sql: string; params: unknown[] }) => Promise<unknown[]>;
};

export function drizzleAdapter(opts: {
  db: DrizzleDb | (() => Promise<DrizzleDb>);
  dialect?: "postgres" | "sqlite";
}): SqlExecutor {
  const dialect = opts.dialect ?? "postgres";
  let resolvedDb: DrizzleDb | null = null;

  async function getDb(): Promise<DrizzleDb> {
    if (!resolvedDb) {
      resolvedDb = typeof opts.db === "function" ? await opts.db() : opts.db;
    }
    return resolvedDb;
  }

  const executor: SqlExecutor = {
    dialect,
    async execute<T = Record<string, unknown>>(sqlText: string, params: unknown[]): Promise<T[]> {
      const db = await getDb();
      // Drizzle expects prepare: false for PgBouncer compatibility
      const result = (await db.execute({ sql: sqlText, params })) as T[];
      return result;
    },

    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const db = await getDb();
      // Access Drizzle's transaction API
      // biome-ignore lint/suspicious/noExplicitAny: Drizzle db cast for transaction API
      const drizzleWithTx = db as any;
      if (typeof drizzleWithTx.transaction === "function") {
        return drizzleWithTx.transaction(async (tx: DrizzleDb) => {
          const txExecutor = drizzleAdapter({ db: tx, dialect });
          return fn(txExecutor);
        });
      }
      // Fallback: execute without transaction (warn)
      console.warn("[flowpanel] drizzleAdapter: transaction not available, executing without tx");
      return fn(executor);
    },

    async advisoryLock(key: bigint): Promise<void> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      await executor.execute(`SELECT pg_advisory_lock($1)`, [key.toString()]);
    },

    async advisoryUnlock(key: bigint): Promise<void> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      await executor.execute(`SELECT pg_advisory_unlock($1)`, [key.toString()]);
    },

    async advisoryTryLock(key: bigint): Promise<boolean> {
      if (dialect !== "postgres") {
        throw new Error("Advisory locks require PostgreSQL");
      }
      const rows = await executor.execute<{ pg_try_advisory_lock: boolean }>(
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

  return executor;
}
