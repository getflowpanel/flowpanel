import { describe, expect, it } from "vitest";
import { dashboardActionAudit } from "../../internal/dashboard-audit";
import {
  type AuditSqlDialect,
  type AuditSqlStatement,
  auditScopeKey,
  sqlAuditLog,
} from "../audit-sql";

function recorder(rows: Array<Record<string, unknown>> = [], total = rows.length) {
  const statements: AuditSqlStatement[] = [];
  const sql = (s: AuditSqlStatement) => s.strings.join("?");
  return {
    statements,
    sql,
    executor: {
      run: async (statement: AuditSqlStatement) => {
        statements.push(statement);
      },
      rows: async (statement: AuditSqlStatement) => {
        statements.push(statement);
        return sql(statement).includes("COUNT(*)") ? [{ n: String(total) }] : rows;
      },
    },
  };
}

const at = new Date("2026-10-09T12:34:56.789Z");

describe("auditScopeKey", () => {
  it("gives the same key whatever order the scope's keys arrive in", () => {
    expect(auditScopeKey({ b: 1, a: { d: 2, c: 3 } })).toBe(
      auditScopeKey({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(auditScopeKey({ tenantId: "t1" })).toBe('{"tenantId":"t1"}');
    expect(auditScopeKey(null)).toBeNull();
    expect(auditScopeKey(undefined)).toBeNull();
  });
});

describe("sqlAuditLog.append", () => {
  it("binds every value and casts JSON and time on PostgreSQL", async () => {
    const { statements, sql, executor } = recorder();
    await sqlAuditLog("postgresql", executor).append({
      actorId: "u1",
      actorName: "Ann",
      action: "orders.update",
      resource: "orders",
      targetId: "7",
      diff: { before: { total: 10n }, after: { total: 12n } },
      scope: { tenantId: "t1" },
      at,
    });
    const [insert] = statements;
    expect(sql(insert ?? { strings: [], values: [] })).toContain("?::jsonb");
    expect(sql(insert ?? { strings: [], values: [] })).toContain("?::timestamptz)");
    expect(insert?.values).toEqual([
      "u1",
      "Ann",
      "orders.update",
      "orders",
      "7",
      '{"before":{"total":"10"},"after":{"total":"12"}}',
      '{"before":{"total":"10"},"after":{"total":"12"}}',
      null,
      null,
      '{"tenantId":"t1"}',
      "2026-10-09T12:34:56.789Z",
    ]);
  });

  it("writes one row per id of a bulk action", async () => {
    const { statements, executor } = recorder();
    await sqlAuditLog("sqlite", executor).append({
      actorId: null,
      action: "orders.bulk.archive",
      resource: "orders",
      targetId: "1,2,3",
      targetIds: ["1", "2", "3"],
      at,
    });
    const values = statements[0]?.values ?? [];
    expect(values.length).toBe(33);
    expect([values[4], values[15], values[26]]).toEqual(["1", "2", "3"]);
  });

  it("writes a MySQL DATETIME in UTC", async () => {
    const { statements, executor } = recorder();
    await sqlAuditLog("mysql", executor).append({ actorId: null, action: "x", at });
    expect(statements[0]?.values.at(-1)).toBe("2026-10-09 12:34:56.789");
  });
});

describe("sqlAuditLog.list", () => {
  it.each<AuditSqlDialect>(["postgresql", "mysql", "sqlite"])(
    "filters, orders newest first and normalises rows on %s",
    async (dialect) => {
      const { statements, sql, executor } = recorder([
        {
          id: "a",
          actor_id: "u1",
          actor_name: null,
          action: "orders.update",
          resource: "orders",
          target_id: "7",
          diff: '{"before":{"s":"a"},"after":{"s":"b"}}',
          at: "2026-10-09 12:34:56.789",
        },
      ]);
      const page = await sqlAuditLog(dialect, executor).list({
        scope: { key: null },
        resource: "orders",
        targetId: "7",
        from: at,
        limit: 20,
        offset: 40,
      });
      expect(page.total).toBe(1);
      expect(page.capped).toBe(false);
      expect(page.entries[0]).toEqual({
        id: "a",
        actorId: "u1",
        actorName: null,
        action: "orders.update",
        resource: "orders",
        targetId: "7",
        diff: { before: { s: "a" }, after: { s: "b" } },
        at,
      });
      const select = sql(statements[0] ?? { strings: [], values: [] });
      expect(select).toContain(
        "WHERE scope_key IS NULL AND resource = ? AND target_id = ? AND at >= ?",
      );
      expect(select).toContain("ORDER BY at DESC, id DESC LIMIT 20 OFFSET 40");
      expect(statements[0]?.values.slice(0, 2)).toEqual(["orders", "7"]);
    },
  );

  it.each<[AuditSqlDialect, string]>([
    ["postgresql", "WHERE id = ?::uuid"],
    ["mysql", "WHERE id = ?"],
    ["sqlite", "WHERE id = ?"],
  ])("reads one event by its id on %s through the primary key", async (dialect, clause) => {
    const { statements, sql, executor } = recorder();
    const id = "0b7c1f7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
    await sqlAuditLog(dialect, executor).list({ id, limit: 1, offset: 0 });
    expect(sql(statements[0] ?? { strings: [], values: [] })).toContain(clause);
    expect(statements[0]?.values).toEqual([id]);
  });

  it.each<[AuditSqlDialect, string, string]>([
    ["postgresql", "diff_preview::text AS diff", "diff::text AS diff"],
    ["mysql", "CAST(diff_preview AS CHAR) AS diff", "CAST(diff AS CHAR) AS diff"],
    ["sqlite", "diff_preview AS diff", " diff AS diff"],
  ])(
    "pages through previews and reads a whole diff for one event on %s",
    async (dialect, page, one) => {
      const { statements, sql, executor } = recorder();
      const store = sqlAuditLog(dialect, executor);
      await store.list({ limit: 50, offset: 0 });
      await store.entry({ id: "0b7c1f7e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", scope: { key: null } });
      const [listed, , single] = statements.map((s) => sql(s));
      expect(listed).toContain(page);
      expect(listed).not.toMatch(/[ ,]diff(::text)? AS diff|CAST\(diff AS/);
      expect(single).toContain(one);
      expect(single).toMatch(/LIMIT 1$/);
    },
  );

  it("answers no event for an id PostgreSQL could not compare with a uuid, without a query", async () => {
    const { statements, executor } = recorder();
    expect(await sqlAuditLog("postgresql", executor).entry({ id: "1 OR 1=1" })).toBeNull();
    expect(statements).toEqual([]);
  });

  it("reads the migration's too-large mark as its fields with empty previews, flagged", async () => {
    const at = "2026-10-09 12:34:56.789";
    const { executor } = recorder([
      {
        id: "a",
        action: "x",
        diff: '{"__flowpanelTooLarge": {"before": ["note"], "after": null}}',
        at,
      },
      { id: "b", action: "x", diff: null, at },
    ]);
    const { entries } = await sqlAuditLog("sqlite", executor).list({ limit: 10, offset: 0 });
    const empty = { __flowpanelPreview: { text: "", length: 0 } };
    expect(entries.map((e) => [e.diff, e.diffTooLarge])).toEqual([
      [{ before: { note: empty }, after: null }, true],
      [null, undefined],
    ]);
  });

  it("finds no event for a non-uuid id on PostgreSQL instead of failing the query", async () => {
    const { statements, sql, executor } = recorder();
    await sqlAuditLog("postgresql", executor).list({ id: "e1", limit: 1, offset: 0 });
    expect(sql(statements[0] ?? { strings: [], values: [] })).toContain("WHERE 1 = 0");
  });

  it("stores a bounded preview beside the whole diff", async () => {
    const { statements, executor } = recorder();
    const long = "x".repeat(300_000);
    await sqlAuditLog("sqlite", executor).append({
      actorId: "u1",
      action: "orders.update",
      diff: { before: { note: "a" }, after: { note: long } },
      at,
    });
    const [diff, preview] = (statements[0]?.values ?? []).slice(5, 7) as string[];
    expect(diff?.length).toBeGreaterThan(300_000);
    expect(preview?.length).toBeLessThan(600);
    expect(JSON.parse(preview ?? "null").after.note).toEqual({
      __flowpanelPreview: { text: "x".repeat(400), length: 300_000 },
    });
  });

  it("keeps limits inside what a page may ask for", async () => {
    const { statements, sql, executor } = recorder();
    await sqlAuditLog("sqlite", executor).list({ limit: 10_000, offset: -5 });
    expect(sql(statements[0] ?? { strings: [], values: [] })).toContain("LIMIT 500 OFFSET 0");
  });
});

describe("sqlAuditLog.facets", () => {
  it("lists actors and actions inside the caller's scope", async () => {
    const { statements, sql, executor } = recorder([{ actor_id: "u1", actor_name: "Ann" }]);
    await sqlAuditLog("postgresql", executor).facets({ scope: { key: '{"t":1}' } });
    expect(sql(statements[0] ?? { strings: [], values: [] })).toContain(
      "WHERE scope_key = ? AND actor_id IS NOT NULL",
    );
    expect(statements.every((s) => s.values[0] === '{"t":1}')).toBe(true);
  });
});

describe("sqlAuditLog visibility", () => {
  it("binds the readable resources and dashboard actions, and keeps other resource-less events", async () => {
    const { statements, sql, executor } = recorder();
    const store = sqlAuditLog("postgresql", executor);
    await store.list({
      visible: {
        resources: ["orders", "users"],
        actions: [dashboardActionAudit("/", "sync").action],
      },
      limit: 10,
      offset: 0,
    });
    const select = sql(statements[0] ?? { strings: [], values: [] });
    expect(select).toContain(
      "WHERE (resource IN (?, ?) OR (resource IS NULL AND action NOT LIKE 'dashboard.action.%') OR ((resource IS NULL OR resource = ?) AND action IN (?)))",
    );
    expect(statements[0]?.values).toEqual([
      "orders",
      "users",
      "dashboard",
      "dashboard.action._root_.sync",
    ]);

    statements.length = 0;
    await store.facets({ visible: { resources: [], actions: [] } });
    expect(
      statements.every((s) =>
        sql(s).includes("WHERE ((resource IS NULL AND action NOT LIKE 'dashboard.action.%'))"),
      ),
    ).toBe(true);
  });
});

describe("sqlAuditLog.append in batches", () => {
  it("splits a large bulk action into statements within the dialect's bound-value limit", async () => {
    const { statements, executor } = recorder();
    const targetIds = Array.from({ length: 10_000 }, (_, i) => String(i));
    await sqlAuditLog("sqlite", executor).append({
      actorId: "u1",
      action: "orders.bulk.delete",
      resource: "orders",
      targetIds,
      at,
    });
    expect(statements.length).toBe(Math.ceil(10_000 / 90));
    expect(statements.every((s) => s.values.length <= 999)).toBe(true);
    const written = statements.flatMap((s) => s.values.filter((_, i) => i % 11 === 4));
    expect(written).toEqual(targetIds);
  });

  it("keeps a PostgreSQL batch under the bound-value limit Prisma enforces", async () => {
    const { statements, executor } = recorder();
    const targetIds = Array.from({ length: 10_000 }, (_, i) => String(i));
    await sqlAuditLog("postgresql", executor).append({
      actorId: "u1",
      action: "orders.bulk.delete",
      targetIds,
      at,
    });
    expect(statements.length).toBe(4);
    expect(statements.every((s) => s.values.length <= 32_767)).toBe(true);
  });
});

describe("sqlAuditLog.append of several batches", () => {
  const targetIds = Array.from({ length: 300 }, (_, i) => String(i));
  const event = { actorId: "u1", action: "orders.bulk.delete", targetIds, at };

  it("writes every batch in one transaction", async () => {
    const { statements, executor } = recorder();
    const inside: number[] = [];
    await sqlAuditLog("sqlite", {
      ...executor,
      transaction: async (run) =>
        run({
          ...executor,
          run: async (statement) => {
            inside.push(statements.length);
            await executor.run(statement);
          },
        }),
    }).append(event);
    expect(statements).toHaveLength(4);
    expect(inside).toHaveLength(4);
  });

  it("writes batch by batch when the driver cannot open a transaction", async () => {
    const { statements, executor } = recorder();
    await sqlAuditLog("sqlite", {
      ...executor,
      transaction: () => {
        throw new Error("No transactions support in neon-http driver");
      },
    }).append(event);
    expect(statements).toHaveLength(4);
  });

  it("fails whole when a batch fails inside the transaction", async () => {
    const { executor } = recorder();
    const failing = sqlAuditLog("sqlite", {
      ...executor,
      transaction: async (run) =>
        run({ ...executor, run: async () => Promise.reject(new Error("disk full")) }),
    });
    await expect(failing.append(event)).rejects.toThrow("disk full");
  });
});

describe("sqlAuditLog count", () => {
  it("stops counting past the cap and says so", async () => {
    const { statements, sql, executor } = recorder([], 10_001);
    const page = await sqlAuditLog("mysql", executor).list({ limit: 50, offset: 0 });
    expect(page).toMatchObject({ total: 10_000, capped: true });
    expect(sql(statements[1] ?? { strings: [], values: [] })).toContain("LIMIT 10001) counted");
  });

  it("reads a malformed stored diff as no diff instead of failing the page", async () => {
    const { executor } = recorder([
      {
        id: "x",
        actor_id: null,
        actor_name: null,
        action: "a",
        resource: null,
        target_id: null,
        diff: "{oops",
        at: "2026-10-09 10:00:00.000",
      },
    ]);
    const page = await sqlAuditLog("sqlite", executor).list({ limit: 1, offset: 0 });
    expect(page.entries[0]?.diff).toBeNull();
  });
});
