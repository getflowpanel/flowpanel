import { FlowpanelConflictError } from "@flowpanel/core";
import { sql } from "drizzle-orm";
import type { DrizzleLikeDb } from "./drizzle-db";

interface SyncSqliteDb {
  resultKind: "sync";
  run: (query: ReturnType<typeof sql>) => unknown;
}

function isSyncSqlite(db: unknown): db is SyncSqliteDb {
  return (
    typeof db === "object" &&
    db !== null &&
    (db as { resultKind?: unknown }).resultKind === "sync" &&
    typeof (db as { run?: unknown }).run === "function"
  );
}

const queues = new WeakMap<object, Promise<unknown>>();

const BUSY_RETRIES = 5;
const BUSY_WAIT_MS = 25;

function isBusy(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && code.startsWith("SQLITE_BUSY");
}

/** BEGIN, waiting briefly while another connection writes; a transaction that cannot open fails cleanly. */
async function begin(db: SyncSqliteDb): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      db.run(sql`BEGIN IMMEDIATE`);
      return;
    } catch (err) {
      if (!isBusy(err) || attempt >= BUSY_RETRIES) {
        const busy = new FlowpanelConflictError("The database is busy. Try again.");
        busy.cause = err;
        throw busy;
      }
      await new Promise((resolve) => setTimeout(resolve, BUSY_WAIT_MS * (attempt + 1)));
    }
  }
}

/** better-sqlite3 cannot await inside its own transaction: BEGIN/COMMIT, one at a time per database. */
function syncSqliteTransaction<T>(db: SyncSqliteDb, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(db) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      await begin(db);
      try {
        const result = await run();
        db.run(sql`COMMIT`);
        return result;
      } catch (err) {
        try {
          db.run(sql`ROLLBACK`);
        } catch {
          // SQLite may already have rolled back (SQLITE_FULL, SQLITE_IOERR); the first error is the answer.
        }
        throw err;
      }
    });
  queues.set(db, next);
  return next;
}

/** One transaction for `run`, on every driver that can hold one across awaits. */
export function runInTransaction<T>(db: unknown, run: (tx: unknown) => Promise<T>): Promise<T> {
  if (isSyncSqlite(db)) return syncSqliteTransaction(db, () => run(db));
  return (db as DrizzleLikeDb).transaction((tx) => run(tx));
}
