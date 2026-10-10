import { FlowpanelConflictError } from "@flowpanel/core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { runInTransaction } from "../transaction";

function syncDb(failOn: (statement: string, calls: string[]) => Error | null) {
  const calls: string[] = [];
  return {
    calls,
    resultKind: "sync" as const,
    run(query: SQL) {
      const statement = (query.queryChunks[0] as { value: string[] }).value.join("");
      calls.push(statement);
      const err = failOn(statement, calls);
      if (err) throw err;
    },
  };
}

function busy(): Error {
  return Object.assign(new Error("database is locked"), { code: "SQLITE_BUSY" });
}

describe("a better-sqlite3 transaction", () => {
  it("answers with the work's own error when ROLLBACK fails too", async () => {
    const db = syncDb((statement) =>
      statement === "ROLLBACK" ? new Error("no transaction") : null,
    );
    await expect(
      runInTransaction(db, async () => {
        throw new Error("constraint failed");
      }),
    ).rejects.toThrow("constraint failed");
  });

  it("waits briefly while another connection holds the write lock", async () => {
    const db = syncDb((statement, calls) =>
      statement === "BEGIN IMMEDIATE" && calls.filter((c) => c === statement).length < 3
        ? busy()
        : null,
    );
    expect(await runInTransaction(db, async () => "done")).toBe("done");
    expect(db.calls).toEqual(["BEGIN IMMEDIATE", "BEGIN IMMEDIATE", "BEGIN IMMEDIATE", "COMMIT"]);
  });

  it("fails cleanly, before any work, when the lock never frees", async () => {
    const db = syncDb((statement) => (statement === "BEGIN IMMEDIATE" ? busy() : null));
    let ran = false;
    await expect(
      runInTransaction(db, async () => {
        ran = true;
      }),
    ).rejects.toBeInstanceOf(FlowpanelConflictError);
    expect(ran).toBe(false);
  });
});
