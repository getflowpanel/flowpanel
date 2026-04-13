import type { SqlExecutor, SqlQuery } from "@flowpanel/core";
import { Pool } from "pg";

type PrismaClientLike = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T[]>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
};

export function prismaAdapter(opts: { prisma: PrismaClientLike }): SqlExecutor {
  const { prisma } = opts;

  // Lazy pool for advisory locks only
  let lockPool: Pool | null = null;
  const lockClients = new Map<string, import("pg").PoolClient>();

  function getLockPool(): Pool {
    if (!lockPool) {
      lockPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 4,
      });
    }
    return lockPool;
  }

  const executor: SqlExecutor = {
    dialect: "postgres",
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
      const client = await pool.connect();
      const k = key.toString();
      lockClients.set(k, client);
      await client.query("SELECT pg_advisory_lock($1)", [k]);
    },

    async advisoryUnlock(key: bigint): Promise<void> {
      const k = key.toString();
      const client = lockClients.get(k);
      if (client) {
        await client.query("SELECT pg_advisory_unlock($1)", [k]);
        client.release();
        lockClients.delete(k);
      }
    },

    async advisoryTryLock(key: bigint): Promise<boolean> {
      const k = key.toString();
      const existing = lockClients.get(k);
      const client = existing ?? (await getLockPool().connect());
      const result = await client.query<{ pg_try_advisory_lock: boolean }>(
        "SELECT pg_try_advisory_lock($1)",
        [k],
      );
      const acquired = result.rows[0]?.pg_try_advisory_lock ?? false;
      if (acquired) {
        lockClients.set(k, client);
      } else if (!existing) {
        client.release();
      }
      return acquired;
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
