import { sql } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import {
  isPromiseLike,
  type MigrationDb,
  migrationsTableDdl,
  readMigrationScalar,
  runRaw,
  runRawDirect,
  selectMigrationIds,
  selectMigrationIdsDirect,
  splitSqlStatements,
} from "./migrations";

function thenMaybe<T>(
  value: T | PromiseLike<T>,
  next: (resolved: T) => unknown | PromiseLike<unknown>,
): unknown | Promise<unknown> {
  if (isPromiseLike(value)) return Promise.resolve(value).then(next);
  const result = next(value);
  return isPromiseLike(result) ? Promise.resolve(result) : result;
}

function runStatementsDirect(
  db: MigrationDb,
  dialect: DrizzleDialect,
  statements: readonly string[],
  index = 0,
): unknown | Promise<unknown> {
  const statement = statements[index];
  if (statement === undefined) return undefined;
  return thenMaybe(runRawDirect(db, dialect, sql.raw(statement)), () =>
    runStatementsDirect(db, dialect, statements, index + 1),
  );
}

async function runStatements(
  db: MigrationDb,
  dialect: DrizzleDialect,
  statements: readonly string[],
): Promise<void> {
  for (const statement of statements) await runRaw(db, dialect, sql.raw(statement));
}

function migrationStatements(rawSql: string, dialect: DrizzleDialect): string[] {
  const statements = splitSqlStatements(rawSql, dialect);
  if (statements.length === 0) throw new Error("drizzleAdapter: migration SQL is empty");
  return statements;
}

export function createMigrationMethods(db: MigrationDb, dialect: DrizzleDialect) {
  return {
    async runMigrationSql(rawSql: string): Promise<void> {
      await runStatements(db, dialect, migrationStatements(rawSql, dialect));
    },

    async applyMigration(id: string, rawSql: string): Promise<void> {
      const statements = migrationStatements(rawSql, dialect);
      if (typeof db.transaction !== "function") {
        throw new Error(
          `drizzleAdapter: dialect "${dialect}" requires a drizzle instance with transaction() ` +
            "to apply migration SQL and its marker safely.",
        );
      }
      await runRaw(db, dialect, sql.raw(migrationsTableDdl(dialect)));

      if (dialect === "sqlite") {
        await db.transaction((target) => {
          // The first write acquires SQLite's database write lock. Rechecking
          // only after that lock closes the CLI's listApplied -> apply race.
          const lock = runRawDirect(
            target,
            dialect,
            sql.raw("UPDATE _flowpanel_migrations SET applied_at = applied_at"),
          );
          return thenMaybe(lock, () => {
            const selected = selectMigrationIdsDirect(
              target,
              dialect,
              sql`SELECT id FROM _flowpanel_migrations WHERE id = ${id}`,
            );
            return thenMaybe(selected, (applied) => {
              if (applied.includes(id)) return undefined;
              return thenMaybe(runStatementsDirect(target, dialect, statements), () =>
                runRawDirect(
                  target,
                  dialect,
                  sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`,
                ),
              );
            });
          });
        });
        return;
      }

      if (dialect === "pg") {
        await db.transaction(async (target) => {
          await runRaw(
            target,
            dialect,
            sql.raw(
              "SELECT pg_advisory_xact_lock(hashtext(current_database()), hashtext('_flowpanel_migrations'))",
            ),
          );
          const applied = await selectMigrationIds(
            target,
            dialect,
            sql`SELECT id FROM _flowpanel_migrations WHERE id = ${id}`,
          );
          if (applied.includes(id)) return;
          await runStatements(target, dialect, statements);
          await runRaw(target, dialect, sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`);
        });
        return;
      }

      // MySQL DDL implicitly commits. The transaction callback pins one
      // connection while its session-level advisory lock is held.
      await db.transaction(async (target) => {
        const lockResult = await runRaw(
          target,
          dialect,
          sql.raw("SELECT GET_LOCK('flowpanel:migrations', 60) AS acquired"),
        );
        if (Number(readMigrationScalar(lockResult, dialect, "acquired")) !== 1) {
          throw new Error("drizzleAdapter: timed out waiting for the MySQL migration lock");
        }
        try {
          const applied = await selectMigrationIds(
            target,
            dialect,
            sql`SELECT id FROM _flowpanel_migrations WHERE id = ${id}`,
          );
          if (applied.includes(id)) return;
          await runStatements(target, dialect, statements);
          await runRaw(target, dialect, sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`);
        } finally {
          await runRaw(
            target,
            dialect,
            sql.raw("SELECT RELEASE_LOCK('flowpanel:migrations') AS released"),
          );
        }
      });
    },

    async listAppliedMigrations(): Promise<Set<string>> {
      await runRaw(db, dialect, sql.raw(migrationsTableDdl(dialect)));
      const ids = await selectMigrationIds(
        db,
        dialect,
        sql.raw("SELECT id FROM _flowpanel_migrations"),
      );
      return new Set(ids);
    },

    async markMigrationApplied(id: string): Promise<void> {
      await runRaw(db, dialect, sql`INSERT INTO _flowpanel_migrations (id) VALUES (${id})`);
    },
  };
}
