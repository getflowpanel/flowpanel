import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createReaper } from "../reaper.js";
import type { SqlExecutor } from "../types/db.js";

function makeMockDb(tryLockResult = true) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const executor: SqlExecutor = {
    async execute(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("RETURNING")) return [{ id: BigInt(42) }] as any;
      return [];
    },
    async transaction(fn) { return fn(executor); },
    async advisoryLock() {},
    async advisoryUnlock() {},
    async advisoryTryLock() { return tryLockResult; },
    sql(strings, ...values) { return { text: strings.join("?"), values }; },
  };
  return { executor, queries };
}

describe("createReaper", () => {
  it("marks orphaned runs as failed", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["parse", "score"],
      reaperThresholds: { parse: "10m", score: "5m" },
    });

    await reaper.sweep();

    const updateQuery = queries.find(
      (q) => q.sql.includes("UPDATE") && q.sql.includes("OrphanedRun")
    );
    expect(updateQuery).toBeDefined();
  });

  it("skips sweep if advisory lock not acquired (non-holder)", async () => {
    const { executor, queries } = makeMockDb(false); // lock unavailable
    const reaper = createReaper({
      db: executor,
      stages: ["parse"],
      reaperThresholds: { parse: "10m" },
    });

    await reaper.sweep();

    const updateQuery = queries.find((q) => q.sql.includes("UPDATE"));
    expect(updateQuery).toBeUndefined();
  });

  it("uses correct threshold per stage", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["parse", "score"],
      reaperThresholds: { parse: "10m", score: "5m" },
    });

    await reaper.sweep();

    // Should generate queries for each stage with correct interval
    const scoreQuery = queries.find(
      (q) => q.sql.includes("score") && q.sql.includes("5 minutes")
    );
    const parseQuery = queries.find(
      (q) => q.sql.includes("parse") && q.sql.includes("10 minutes")
    );
    expect(scoreQuery).toBeDefined();
    expect(parseQuery).toBeDefined();
  });

  it("does NOT kill runs within threshold", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["score"],
      reaperThresholds: { score: "5m" },
    });

    await reaper.sweep();

    // Verify the WHERE clause uses started_at < now() - INTERVAL (not >)
    const updateQuery = queries.find((q) => q.sql.includes("UPDATE"));
    expect(updateQuery?.sql).toContain("started_at <");
    expect(updateQuery?.sql).not.toContain("started_at >");
  });
});
