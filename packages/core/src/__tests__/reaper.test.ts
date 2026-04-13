import { describe, expect, it } from "vitest";
import { createReaper } from "../reaper";
import type { SqlExecutor } from "../types/db";

function makeMockDb(tryLockResult = true) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const executor: SqlExecutor = {
    async execute(sql, params) {
      queries.push({ sql, params });
      // biome-ignore lint/suspicious/noExplicitAny: test mock cast
      if (sql.includes("RETURNING")) return [{ id: BigInt(42) }] as any;
      return [];
    },
    async transaction(fn) {
      return fn(executor);
    },
    async advisoryLock() {},
    async advisoryUnlock() {},
    async advisoryTryLock() {
      return tryLockResult;
    },
    sql(strings, ...values) {
      return { text: strings.join("?"), values };
    },
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
      (q) => q.sql.includes("UPDATE") && q.sql.includes("OrphanedRun"),
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

  it("uses correct threshold per stage (parameterized)", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["parse", "score"],
      reaperThresholds: { parse: "10m", score: "5m" },
    });

    await reaper.sweep();

    const updates = queries.filter((q) => q.sql.includes("UPDATE flowpanel_pipeline_run"));
    expect(updates).toHaveLength(2);

    // Params: [stage, thresholdMinutes]
    const parseUpdate = updates.find((q) => q.params[0] === "parse");
    const scoreUpdate = updates.find((q) => q.params[0] === "score");
    expect(parseUpdate?.params[1]).toBe(10);
    expect(scoreUpdate?.params[1]).toBe(5);
  });

  it("does NOT kill runs within threshold", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["score"],
      reaperThresholds: { score: "5m" },
    });

    await reaper.sweep();

    // Verify the WHERE clause uses started_at < now() - make_interval
    const updateQuery = queries.find((q) => q.sql.includes("UPDATE"));
    expect(updateQuery?.sql).toContain("started_at <");
    expect(updateQuery?.sql).not.toContain("started_at >");
  });

  it("parameterizes stage and interval — no SQL injection via stage name", async () => {
    const { executor, queries } = makeMockDb(true);
    const reaper = createReaper({
      db: executor,
      stages: ["'; DROP TABLE x; --"],
      reaperThresholds: {},
    });

    await reaper.sweep();

    const updateQuery = queries.find((q) => q.sql.includes("UPDATE flowpanel_pipeline_run"));
    expect(updateQuery).toBeDefined();
    // SQL must not contain the injected payload — stage flows as $1 param
    expect(updateQuery?.sql).not.toContain("DROP");
    expect(updateQuery?.sql).toContain("stage = $1");
    expect(updateQuery?.sql).toContain("make_interval(mins => $2)");
    expect(updateQuery?.params[0]).toBe("'; DROP TABLE x; --");
    expect(typeof updateQuery?.params[1]).toBe("number");
  });
});
