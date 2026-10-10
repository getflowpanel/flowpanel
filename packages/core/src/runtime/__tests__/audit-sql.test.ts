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
    expect(values.length).toBe(30);
    expect([values[4], values[14], values[24]]).toEqual(["1", "2", "3"]);
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
      visible: { resources: ["orders", "users"], actions: [dashboardActionAudit("sync").action] },
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
      "dashboard.action.sync",
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
    expect(statements.length).toBe(Math.ceil(10_000 / 99));
    expect(statements.every((s) => s.values.length <= 999)).toBe(true);
    const written = statements.flatMap((s) => s.values.filter((_, i) => i % 10 === 4));
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
