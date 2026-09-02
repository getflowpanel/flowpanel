import { randomUUID } from "node:crypto";
import { MIGRATIONS_TABLE_DDL, type PrismaClientLike } from "./runtime";
import { type PrismaProvider, splitSqlStatements } from "./sql-statements";

const CLAIMS_TABLE_DDL = `CREATE TABLE IF NOT EXISTS _flowpanel_migration_claims (
  id varchar(255) NOT NULL PRIMARY KEY,
  owner varchar(255) NOT NULL,
  state varchar(16) NOT NULL,
  statement_index int NOT NULL DEFAULT 0,
  error_message text NULL,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const LOCK_TABLE_DDL = `CREATE TABLE IF NOT EXISTS _flowpanel_migration_lock (
  id integer NOT NULL PRIMARY KEY,
  locked_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const SQLITE_WRITE_LOCK = `INSERT INTO _flowpanel_migration_lock (id, locked_at) VALUES (1, CURRENT_TIMESTAMP)
  ON CONFLICT (id) DO UPDATE SET locked_at = CURRENT_TIMESTAMP`;

// pg_advisory_xact_lock() returns void, which Prisma cannot deserialize.
const PG_ADVISORY_LOCK = `SELECT true AS locked FROM (
  SELECT pg_advisory_xact_lock(hashtext('flowpanel:migrations'), hashtext($1))
) AS advisory_lock`;

const CLAIM_INSERT = `INSERT INTO _flowpanel_migration_claims (id, owner, state, statement_index)
  VALUES (?, ?, 'running', 0)`;

const CLAIM_PROGRESS = `UPDATE _flowpanel_migration_claims
  SET statement_index = ?, state = 'running', updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND owner = ?`;

const CLAIM_FAILED = `UPDATE _flowpanel_migration_claims
  SET statement_index = ?, error_message = ?, state = 'failed', updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND owner = ?`;

const CLAIM_POLL_MS = 50;
const CLAIM_WAIT_MS = 60_000;

interface MigrationClaim {
  owner: string;
  state: string;
  statement_index: number;
  error_message: string | null;
}

function marker(provider: PrismaProvider): string {
  const placeholder = provider === "postgresql" ? "$1" : "?";
  return `INSERT INTO _flowpanel_migrations (id) VALUES (${placeholder})`;
}

function appliedQuery(provider: PrismaProvider): string {
  const placeholder = provider === "postgresql" ? "$1" : "?";
  return `SELECT id FROM _flowpanel_migrations WHERE id = ${placeholder}`;
}

function statementsOf(rawSql: string, provider: PrismaProvider): string[] {
  const statements = splitSqlStatements(rawSql, provider);
  if (statements.length === 0) throw new Error("prismaAdapter: migration SQL is empty");
  return statements;
}

async function runStatements(db: PrismaClientLike, statements: readonly string[]): Promise<void> {
  for (const statement of statements) await db.$executeRawUnsafe(statement);
}

async function isApplied(
  db: PrismaClientLike,
  provider: PrismaProvider,
  id: string,
): Promise<boolean> {
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(appliedQuery(provider), id);
  return rows.length > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PostgreSQL and SQLite keep the statements and the applied marker in one
 * transaction. Serializing first, then rechecking the id inside that boundary,
 * is what stops two migrators from running the same file.
 */
async function applyInTransaction(
  prisma: PrismaClientLike,
  provider: "postgresql" | "sqlite",
  id: string,
  statements: readonly string[],
): Promise<void> {
  if (typeof prisma.$transaction !== "function") {
    throw new Error(
      `prismaAdapter: provider "${provider}" needs a Prisma client with $transaction() to apply ` +
        "a migration and its marker together.",
    );
  }
  if (provider === "sqlite") await prisma.$executeRawUnsafe(LOCK_TABLE_DDL);

  await prisma.$transaction(async (tx) => {
    if (provider === "postgresql") {
      await tx.$queryRawUnsafe(PG_ADVISORY_LOCK, id);
    } else {
      // SQLite has no advisory lock; the upsert takes the database write lock.
      await tx.$executeRawUnsafe(SQLITE_WRITE_LOCK);
    }

    if (await isApplied(tx, provider, id)) return;
    await runStatements(tx, statements);
    await tx.$executeRawUnsafe(marker(provider), id);
  });
}

async function readClaim(prisma: PrismaClientLike, id: string): Promise<MigrationClaim | null> {
  const rows = await prisma.$queryRawUnsafe<MigrationClaim[]>(
    `SELECT id, owner, state, statement_index, error_message
     FROM _flowpanel_migration_claims WHERE id = ?`,
    id,
  );
  return rows[0] ?? null;
}

/**
 * The primary key decides the winner. Affected-row counts cannot: MySQL clients
 * differ on whether a no-op upsert reports zero rows or one matched row.
 */
async function tryClaim(prisma: PrismaClientLike, id: string, owner: string): Promise<boolean> {
  try {
    return (await prisma.$executeRawUnsafe(CLAIM_INSERT, id, owner)) > 0;
  } catch (error) {
    if (!(await readClaim(prisma, id))) throw error;
    return false;
  }
}

async function acquireClaim(prisma: PrismaClientLike, id: string, owner: string): Promise<void> {
  const deadline = Date.now() + CLAIM_WAIT_MS;
  for (;;) {
    if (await tryClaim(prisma, id, owner)) return;
    const claim = await readClaim(prisma, id);
    if (claim?.owner === owner) return;
    if (claim?.state === "failed") {
      throw new Error(
        `prismaAdapter: migration "${id}" holds a failed durable claim and needs manual recovery: ` +
          `it stopped at statement ${claim.statement_index} with "${claim.error_message ?? "unknown error"}". ` +
          "Repair the schema, then delete that row from _flowpanel_migration_claims.",
      );
    }
    if (Date.now() > deadline) {
      throw new Error(
        `prismaAdapter: timed out waiting for migration "${id}", claimed by ` +
          `"${claim?.owner ?? "another migrator"}". Delete the row from ` +
          "_flowpanel_migration_claims if that migrator is gone.",
      );
    }
    await sleep(CLAIM_POLL_MS);
  }
}

/**
 * MySQL commits DDL implicitly, so no transaction can roll a half-applied file
 * back. A durable claim row is the honest alternative: it serializes migrators,
 * survives a crashed one, and records how far the failed run got.
 */
async function applyWithClaim(
  prisma: PrismaClientLike,
  id: string,
  statements: readonly string[],
): Promise<void> {
  await prisma.$executeRawUnsafe(CLAIMS_TABLE_DDL);

  if (await isApplied(prisma, "mysql", id)) {
    await prisma.$executeRawUnsafe(`DELETE FROM _flowpanel_migration_claims WHERE id = ?`, id);
    return;
  }

  const owner = `${process.pid}:${randomUUID()}`;
  await acquireClaim(prisma, id, owner);

  let index = 0;
  try {
    if (!(await isApplied(prisma, "mysql", id))) {
      for (const statement of statements) {
        index += 1;
        await prisma.$executeRawUnsafe(CLAIM_PROGRESS, index, id, owner);
        await prisma.$executeRawUnsafe(statement);
      }
      await prisma.$executeRawUnsafe(marker("mysql"), id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$executeRawUnsafe(CLAIM_FAILED, index, message, id, owner);
    throw new Error(
      `prismaAdapter: migration "${id}" left a durable recovery claim after failing at ` +
        `statement ${index} of ${statements.length}: ${message}`,
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM _flowpanel_migration_claims WHERE id = ? AND owner = ?`,
    id,
    owner,
  );
}

export function createMigrationMethods(prisma: PrismaClientLike, provider: PrismaProvider) {
  return {
    async runMigrationSql(rawSql: string): Promise<void> {
      const statements = statementsOf(rawSql, provider);
      if (typeof prisma.$transaction === "function") {
        await prisma.$transaction((tx) => runStatements(tx, statements));
      } else {
        await runStatements(prisma, statements);
      }
    },

    async applyMigration(id: string, rawSql: string): Promise<void> {
      const statements = statementsOf(rawSql, provider);
      await prisma.$executeRawUnsafe(MIGRATIONS_TABLE_DDL);
      if (provider === "mysql") await applyWithClaim(prisma, id, statements);
      else await applyInTransaction(prisma, provider, id, statements);
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      await prisma.$executeRawUnsafe(MIGRATIONS_TABLE_DDL);
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM _flowpanel_migrations`,
      );
      return new Set(rows.map((row) => row.id));
    },

    async markMigrationApplied(id: string): Promise<void> {
      await prisma.$executeRaw`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`;
    },
  };
}
