import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { rawSqlRows } from "../sql-params";

function recorder(result: unknown) {
  const calls: SQL[] = [];
  const record = (query: SQL) => {
    calls.push(query);
    return Promise.resolve(result);
  };
  return { calls, execute: record, all: record };
}

function compiled(query: SQL): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(query);
}

function parts(...literals: string[]): TemplateStringsArray {
  return Object.assign([...literals], { raw: [...literals] });
}

describe("rawSqlRows", () => {
  it("binds every value as a parameter instead of interpolating it", async () => {
    const db = recorder([]);
    const hostile = "x'; drop table users; --";
    await rawSqlRows(db, "pg", parts("select * from users where email = ", " and n > ", ""), [
      hostile,
      3,
    ]);
    const query = compiled(db.calls[0] as SQL);
    expect(query.sql).toBe("select * from users where email = $1 and n > $2");
    expect(query.params).toEqual([hostile, 3]);
  });

  it("sanitises the bound values on the way out", async () => {
    const db = recorder([]);
    await rawSqlRows(db, "pg", parts("select 1 where at > ", ""), [
      new Date("2026-01-02T03:04:05.000Z"),
    ]);
    expect(compiled(db.calls[0] as SQL).params).toEqual(["2026-01-02T03:04:05.000Z"]);
  });

  it("normalises node-postgres, postgres-js, mysql2 and sqlite row shapes", async () => {
    const rows = [{ n: 1 }];
    expect(await rawSqlRows(recorder({ rows }), "pg", parts("select 1"), [])).toEqual(rows);
    expect(await rawSqlRows(recorder(rows), "pg", parts("select 1"), [])).toEqual(rows);
    expect(await rawSqlRows(recorder([rows, []]), "mysql", parts("select 1"), [])).toEqual(rows);
    expect(await rawSqlRows(recorder(rows), "sqlite", parts("select 1"), [])).toEqual(rows);
  });

  it("reads sqlite through all() and pg through execute()", async () => {
    const sqlite = { all: (q: SQL) => Promise.resolve([{ q }]) };
    await expect(rawSqlRows(sqlite, "sqlite", parts("select 1"), [])).resolves.toHaveLength(1);
    await expect(rawSqlRows(sqlite, "pg", parts("select 1"), [])).rejects.toThrow(/`execute\(\)`/);
  });

  it("parses zoneless timestamps in the driver's rows", async () => {
    const [row] = await rawSqlRows<{ at: Date }>(
      recorder([{ at: "2026-01-02 03:04:05" }]),
      "pg",
      parts("select 1"),
      [],
    );
    expect((row?.at as Date).toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });
});
