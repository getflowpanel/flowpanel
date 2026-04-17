import { describe, expect, it, vi } from "vitest";
import { renderSection } from "../../trpc/procedures/drawers";

function makeMockDb() {
  const queries: { sql: string; params: unknown[] }[] = [];
  const execute = vi.fn(async (sql: string, params: unknown[]) => {
    queries.push({ sql, params });
    return [];
  });
  return { db: { execute }, queries, execute };
}

describe("drawers.breakdown SQL injection", () => {
  it("returns empty array when groupBy is not in whitelist", async () => {
    const { db, execute } = makeMockDb();
    const result = await renderSection(
      db,
      {},
      { type: "breakdown", groupBy: "id; DROP TABLE x; --" },
      {},
    );
    expect(result).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it("accepts 'stage' (default) and runs the query", async () => {
    const { db, queries } = makeMockDb();
    await renderSection(db, {}, { type: "breakdown" }, {});
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain("SELECT stage AS label");
    expect(queries[0]?.sql).toContain("GROUP BY stage");
  });

  it("accepts all 4 whitelisted columns", async () => {
    const allowed = ["stage", "status", "partition_key", "error_class"];
    for (const col of allowed) {
      const { db, queries } = makeMockDb();
      await renderSection(db, {}, { type: "breakdown", groupBy: col }, {});
      expect(queries[0]?.sql).toContain(`SELECT ${col} AS label`);
      expect(queries[0]?.sql).toContain(`GROUP BY ${col}`);
    }
  });

  it("rejects arbitrary column names (including legitimate-looking ones)", async () => {
    const { db, execute } = makeMockDb();
    const result = await renderSection(db, {}, { type: "breakdown", groupBy: "user_id" }, {});
    expect(result).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });
});
