import type { SqlExecutor, SqlQuery, ResourceAdapter } from "@flowpanel/core";
import { Pool } from "pg";
import { extractModelsFromDmmf, extractEnumsFromDmmf, type DmmfDatamodel } from "./metadata";
import { createPrismaResourceAdapter } from "./resource";

type PrismaClientLike = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T[]>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $transaction<T>(fn: (tx: PrismaClientLike) => Promise<T>): Promise<T>;
  [key: string]: unknown;
};

function createSqlExecutor(prisma: PrismaClientLike): SqlExecutor {
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
        const txExecutor = createSqlExecutor(tx);
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

function tryResolveDmmf(prisma: PrismaClientLike): { datamodel: DmmfDatamodel } | null {
  // Prisma 5+: stored on the instance
  if (prisma._baseDmmf) return prisma._baseDmmf as { datamodel: DmmfDatamodel };
  // Try require('@prisma/client').Prisma.dmmf
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Prisma } = require("@prisma/client") as {
      Prisma?: { dmmf?: { datamodel: DmmfDatamodel } };
    };
    if (Prisma?.dmmf) return Prisma.dmmf;
  } catch {
    // not installed or not accessible
  }
  return null;
}

export function prismaAdapter(opts: {
  prisma: PrismaClientLike;
  /** Optionally pass the DMMF directly (e.g. from `import { Prisma } from "@prisma/client"`). */
  dmmf?: { datamodel: DmmfDatamodel };
}): {
  sql: SqlExecutor;
  resource: ResourceAdapter;
} {
  const { prisma } = opts;
  const sql = createSqlExecutor(prisma);

  const dmmf = opts.dmmf ?? tryResolveDmmf(prisma);

  if (!dmmf) {
    throw new Error(
      "Could not resolve Prisma DMMF. Pass `dmmf` explicitly: " +
        "`prismaAdapter({ prisma, dmmf: Prisma.dmmf })`",
    );
  }

  const models = extractModelsFromDmmf(dmmf);
  const enums = extractEnumsFromDmmf(dmmf);
  const resource = createPrismaResourceAdapter(prisma as Record<string, unknown>, models, enums);

  return { sql, resource };
}
