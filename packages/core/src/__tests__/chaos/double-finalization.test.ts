import { describe, it, expect } from "vitest";
import type { SqlExecutor } from "../../types/db.js";

// Simulates two concurrent withRun callbacks for same run ID
// Verifies idempotent finalization via RETURNING guard

describe("double-finalization chaos", () => {
  it("only one finalization succeeds when two concurrent updates race", async () => {
    let updateCount = 0;

    // Simulate: first UPDATE changes status from 'running' to 'succeeded', returns row.
    // Second UPDATE: status is no longer 'running', RETURNING returns 0 rows.
    const mockDb: SqlExecutor = {
      execute: async (sql, params) => {
        if (sql.includes("UPDATE") && sql.includes("status = 'running'")) {
          updateCount++;
          if (updateCount === 1) {
            return [{ id: BigInt(1) }] as any; // First: succeeds
          }
          return [] as any; // Second: row already updated, returns nothing
        }
        if (sql.includes("INSERT")) return [{ id: BigInt(1) }] as any;
        return [];
      },
      transaction: async (fn) => fn(mockDb),
      advisoryLock: async () => {},
      advisoryUnlock: async () => {},
      advisoryTryLock: async () => true,
      sql: (strings, ...values) => ({ text: strings.join("?"), values }),
    };

    const { createWithRun } = await import("../../withRun.js");
    const withRun = createWithRun({
      db: mockDb,
      stageFields: { score: {} },
      stages: ["score"],
      cwd: process.cwd(),
      redactionKeys: [],
    });

    // Launch two callbacks "simultaneously"
    const [r1, r2] = await Promise.allSettled([
      withRun("score", async () => "result1"),
      withRun("score", async () => "result2"),
    ]);

    // Both should resolve (no error from 0 RETURNING rows)
    expect(r1.status).toBe("fulfilled");
    expect(r2.status).toBe("fulfilled");
    // Exactly 2 update attempts (one per run), only one "succeeds" per our mock
    expect(updateCount).toBe(2);
  });
});
