import type { SqlExecutor, SqlQuery } from "@flowpanel/core";
import { Pool } from "pg";

type PrismaClientLike = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T[]>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
};

export function prismaAdapter(opts: { prisma: PrismaClientLike }): SqlExecutor {
  const { prisma } = opts;

  // Lazy single-connection pool for advisory locks only
  let lockPool: Pool | null = null;
  let lockClient: import("pg").PoolClient | null = null;

  function getLockPool(): Pool {
    if (!lockPool) {
      lockPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 1,
      });
    }
    return lockPool;
  }

  const executor: SqlExecutor = {
    async execute<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]> {
      return prisma.$queryRawUnsafe<T>(sql, ...params);
    },

    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx: PrismaClientLike) => {
        const txExecutor = prismaAdapter({ prisma: tx });
        return fn(txExecutor);
      });
    },

    async advisoryLock(key: bigint): Promise<void> {
      const pool = getLockPool();
      lockClient = await pool.connect();
      await lockClient.query("SELECT pg_advisory_lock($1)", [key.toString()]);
      // Note: lockClient is intentionally NOT released — lock is session-scoped
    },

    async advisoryUnlock(key: bigint): Promise<void> {
      if (lockClient) {
        await lockClient.query("SELECT pg_advisory_unlock($1)", [key.toString()]);
        lockClient.release();
        lockClient = null;
      }
    },

    async advisoryTryLock(key: bigint): Promise<boolean> {
      const pool = getLockPool();
      const client = await pool.connect();
      try {
        const result = await client.query<{ pg_try_advisory_lock: boolean }>(
          "SELECT pg_try_advisory_lock($1)",
          [key.toString()],
        );
        return result.rows[0]?.pg_try_advisory_lock ?? false;
      } finally {
        client.release();
      }
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
