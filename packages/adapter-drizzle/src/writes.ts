import { and, eq, is, SQL, sql } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import { type DrizzleLikeDb, firstRow, type Row, type WriteTarget } from "./drizzle-db";
import { type MigrationDb, selectRaw } from "./migrations";
import { defaultOf, outOfScope, rowSatisfiesScope, scopeHolds } from "./scope";

type Insert = (handle: DrizzleLikeDb, target: WriteTarget, input: Row) => Promise<Row | undefined>;
type Update = (
  handle: DrizzleLikeDb,
  target: WriteTarget,
  input: Row,
  id: string,
  where: SQL,
) => Promise<Row | undefined>;
type ScopedInsert = (
  db: DrizzleLikeDb,
  target: WriteTarget,
  input: Row,
  scope: SQL[],
) => Promise<Row | undefined>;
type ScopedUpdate = (
  db: DrizzleLikeDb,
  target: WriteTarget,
  input: Row,
  id: string,
  scope: SQL[],
) => Promise<Row | undefined>;

/** How one dialect writes a row, with and without a tenant scope to keep it in. */
export interface DialectWrites {
  insert: Insert;
  update: Update;
  scopedInsert: ScopedInsert;
  scopedUpdate: ScopedUpdate;
}

function pkColumn(target: WriteTarget) {
  if (!target.pkCol) throw new Error(`drizzleAdapter: primary key column "${target.pk}" not found`);
  return target.pkCol;
}

function scopedWhere(target: WriteTarget, id: string, scope: SQL[]): SQL {
  return and(eq(pkColumn(target), id), ...scope) as SQL;
}

async function returningInsert(handle: DrizzleLikeDb, target: WriteTarget, input: Row) {
  const rows = await handle.insert(target.ref).values(input).returning();
  return rows[0];
}

async function returningUpdate(
  handle: DrizzleLikeDb,
  target: WriteTarget,
  input: Row,
  _id: string,
  where: SQL,
) {
  const rows = await handle.update(target.ref).set(input).where(where).returning();
  return rows[0];
}

/** Without RETURNING the row is read back by its id, which the input may have changed. */
async function readBackUpdate(
  handle: DrizzleLikeDb,
  target: WriteTarget,
  input: Row,
  id: string,
  where: SQL,
) {
  const select = () => handle.select().from(target.ref);
  if (target.pk in input && !(await firstRow(select(), where))) return undefined;
  await handle.update(target.ref).set(input).where(where);
  const key = target.pk in input ? input[target.pk] : id;
  return firstRow(select(), eq(pkColumn(target), key));
}

/** mysql has no RETURNING: the id is known before the insert, or reported by the auto-increment counter. */
async function mysqlInsert(handle: DrizzleLikeDb, target: WriteTarget, input: Row) {
  const pkCol = pkColumn(target);
  const given = input[target.pk];
  const missing = given === undefined || given === null;
  if (pkCol.primary && pkCol.autoIncrement) {
    const { [target.pk]: _key, ...rest } = input;
    const [created] = await handle
      .insert(target.ref)
      .values(missing ? rest : input)
      .$returningId();
    return firstRow(handle.select().from(target.ref), eq(pkCol, created?.[target.pk]));
  }
  const id = missing ? defaultOf(pkCol) : given;
  if (id === undefined || id === null || is(id, SQL)) {
    throw new Error(
      `drizzleAdapter: create on mysql needs input.${target.pk}, because mysql cannot report a key the ` +
        `database generates. Pass it, or give the column autoincrement() or $defaultFn(() => crypto.randomUUID()).`,
    );
  }
  await handle.insert(target.ref).values({ ...input, [target.pk]: id });
  return firstRow(handle.select().from(target.ref), eq(pkCol, id));
}

/** Runs in a transaction when the driver opens one; a driver that cannot, such as neon-http, takes `fallback`. */
async function inTransactionOr<T>(
  db: DrizzleLikeDb,
  run: (tx: DrizzleLikeDb) => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  let started = false;
  try {
    return await db.transaction((tx) => {
      started = true;
      return run(tx);
    });
  } catch (err) {
    if (started) throw err;
    return fallback();
  }
}

async function probe(db: DrizzleLikeDb, dialect: DrizzleDialect, holds: SQL): Promise<boolean> {
  const [row] = await selectRaw(db as MigrationDb, dialect, sql`SELECT ${holds} AS ok`);
  return Boolean(row && Number(row.ok));
}

/** Checks the row before it is written; the delete only catches a trigger that moved it afterwards. */
function probedInsert(dialect: DrizzleDialect, insert: Insert): ScopedInsert {
  return async (db, target, input, scope) => {
    const holds = scopeHolds(dialect, target.ref, target.cols, input, scope);
    if (!(await probe(db, dialect, holds))) throw outOfScope("create");
    const row = await insert(db, target, input);
    const { pkCol } = target;
    if (row && pkCol && !(await rowSatisfiesScope(db, target.ref, pkCol, row[target.pk], scope))) {
      await db.delete(target.ref).where(eq(pkCol, row[target.pk]));
      throw outOfScope("create");
    }
    return row;
  };
}

/** Checks the row as the update would leave it, then writes under the scope. */
function probedUpdate(dialect: DrizzleDialect, update: Update): ScopedUpdate {
  return async (db, target, input, id, scope) => {
    const pkCol = pkColumn(target);
    const holds = scopeHolds(dialect, target.ref, target.cols, input, scope, eq(pkCol, id));
    if (!(await probe(db, dialect, holds))) {
      if (await rowSatisfiesScope(db, target.ref, pkCol, id, scope)) throw outOfScope("update");
      return undefined;
    }
    return update(db, target, input, id, scopedWhere(target, id, scope));
  };
}

function transactionalInsert(dialect: DrizzleDialect, insert: Insert): ScopedInsert {
  const fallback = probedInsert(dialect, insert);
  return (db, target, input, scope) =>
    inTransactionOr(
      db,
      async (tx) => {
        const row = await insert(tx, target, input);
        if (!row)
          throw new Error(
            "drizzleAdapter: the created row could not be read back to check its scope",
          );
        const { pkCol } = target;
        if (pkCol && !(await rowSatisfiesScope(tx, target.ref, pkCol, row[target.pk], scope))) {
          throw outOfScope("create");
        }
        return row;
      },
      () => fallback(db, target, input, scope),
    );
}

function transactionalUpdate(dialect: DrizzleDialect, update: Update): ScopedUpdate {
  const fallback = probedUpdate(dialect, update);
  return (db, target, input, id, scope) =>
    inTransactionOr(
      db,
      async (tx) => {
        const pkCol = pkColumn(target);
        if (!(await rowSatisfiesScope(tx, target.ref, pkCol, id, scope))) return undefined;
        const row = await update(tx, target, input, id, scopedWhere(target, id, scope));
        if (row && !(await rowSatisfiesScope(tx, target.ref, pkCol, row[target.pk], scope))) {
          throw outOfScope("update");
        }
        return row;
      },
      () => fallback(db, target, input, id, scope),
    );
}

/** SQLite drivers here cannot hold a transaction across awaits: the update checks inside its own statement. */
const sqliteScopedUpdate: ScopedUpdate = async (db, target, input, id, scope) => {
  const pkCol = pkColumn(target);
  const holds = scopeHolds("sqlite", target.ref, target.cols, input, scope, eq(pkCol, id));
  const [row] = await db
    .update(target.ref)
    .set(input)
    .where(and(scopedWhere(target, id, scope), holds) as SQL)
    .returning();
  if (row) return row;
  if (await rowSatisfiesScope(db, target.ref, pkCol, id, scope)) throw outOfScope("update");
  return undefined;
};

export const DIALECT_WRITES: Readonly<Record<DrizzleDialect, DialectWrites>> = {
  pg: {
    insert: returningInsert,
    update: returningUpdate,
    scopedInsert: transactionalInsert("pg", returningInsert),
    scopedUpdate: transactionalUpdate("pg", returningUpdate),
  },
  mysql: {
    insert: mysqlInsert,
    update: readBackUpdate,
    scopedInsert: transactionalInsert("mysql", mysqlInsert),
    scopedUpdate: transactionalUpdate("mysql", readBackUpdate),
  },
  sqlite: {
    insert: returningInsert,
    update: readBackUpdate,
    scopedInsert: probedInsert("sqlite", returningInsert),
    scopedUpdate: sqliteScopedUpdate,
  },
};
