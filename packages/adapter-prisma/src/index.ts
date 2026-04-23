import type { ResourceAdapter, SqlExecutor, SqlQuery } from "@flowpanel/core";
import { Pool } from "pg";
import { type DmmfDatamodel, extractEnumsFromDmmf, extractModelsFromDmmf } from "./metadata";
import { createPrismaResourceAdapter } from "./resource";
import { prismaBridge } from "./typed";

export { prismaBridge } from "./typed";

// Register the typed-builder bridge so `defineResource(prisma.user, …)` can
// resolve delegates to metadata through @flowpanel/core without a direct
// Prisma dependency.
{
  // biome-ignore lint/suspicious/noExplicitAny: cross-package bridge
  const g = globalThis as any;
  g.__FP_PRISMA_TYPED__ = {
    inferMetadata: (delegate: unknown) => prismaBridge.inferMetadata(delegate),
  };
}

// Structural shape of a PrismaClient sufficient for the SQL executor.
// Kept loose so the generated `@prisma/client` (with its overloaded
// $transaction and DMMF additions) satisfies it without a cast.
type PrismaClientLike = {
  $queryRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
  $transaction: (...args: unknown[]) => Promise<unknown>;
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
      return prisma.$queryRawUnsafe(sql, ...params) as Promise<T[]>;
    },

    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx: PrismaClientLike) => {
        const txExecutor = createSqlExecutor(tx);
        return fn(txExecutor);
      }) as Promise<T>;
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
  // Prisma 5+: stored on the instance (not part of the public type)
  const baseDmmf = (prisma as Record<string, unknown>)._baseDmmf;
  if (baseDmmf) return baseDmmf as { datamodel: DmmfDatamodel };
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

  // Register delegates with the typed-builder bridge so
  // `defineResource(prisma.user, …)` can resolve to ModelMetadata.
  prismaBridge.register(prisma as Record<string, unknown>, models);

  return { sql, resource };
}
