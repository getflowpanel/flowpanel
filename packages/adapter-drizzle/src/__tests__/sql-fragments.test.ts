import { is, SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { rawSqlRows } from "../sql-params";

function recorder() {
  const calls: SQL[] = [];
  const record = (query: SQL) => {
    calls.push(query);
    return Promise.resolve([]);
  };
  return { calls, execute: record, all: record };
}

function parts(...literals: string[]): TemplateStringsArray {
  return Object.assign([...literals], { raw: [...literals] });
}

const compiled = (query: SQL | undefined) => new PgDialect().sqlToQuery(query as SQL);

describe("rawSqlRows with nested fragments", () => {
  it("binds a Date two fragments deep as ISO text", async () => {
    const db = recorder();
    const since = sql`created_at >= ${new Date("2026-09-01T10:00:00.000Z")}`;
    const scope = sql`(${since} and status = ${"paid"})`;
    await rawSqlRows(db, "pg", parts("select 1 from orders where ", ""), [scope]);
    const query = compiled(db.calls[0]);
    expect(query.sql).toBe("select 1 from orders where (created_at >= $1 and status = $2)");
    expect(query.params).toEqual(["2026-09-01T10:00:00.000Z", "paid"]);
  });

  it("binds a bigint and a Date inside an array inside a fragment", async () => {
    const db = recorder();
    const at = new Date("2026-09-02T00:00:00.000Z");
    const inList = sql`id in ${[10n, 11n]} or created_at in ${[at]}`;
    await rawSqlRows(db, "pg", parts("select 1 where ", ""), [inList]);
    expect(compiled(db.calls[0]).params).toEqual(["10", "11", "2026-09-02T00:00:00.000Z"]);
  });

  it("leaves the text, the order of parameters and the outer values as they were", async () => {
    const db = recorder();
    const window = sql`at >= ${new Date("2026-09-01T00:00:00.000Z")}`;
    await rawSqlRows(db, "pg", parts("select ", " where ", " and n > ", ""), [
      sql`count(*)::int`,
      window,
      3,
    ]);
    const query = compiled(db.calls[0]);
    expect(query.sql).toBe("select count(*)::int where at >= $1 and n > $2");
    expect(query.params).toEqual(["2026-09-01T00:00:00.000Z", 3]);
  });

  it("keeps a fragment's inlineParams() and reaches inside an aliased fragment", async () => {
    const db = recorder();
    const at = new Date("2026-09-01T00:00:00.000Z");
    const inline = sql`status = ${"paid"} and at >= ${at}`.inlineParams();
    const latest = sql`max(at) filter (where at >= ${at})`.as("latest");
    await rawSqlRows(db, "pg", parts("select ", " from orders where ", ""), [latest, inline]);
    const query = compiled(db.calls[0]);
    expect(query.sql).toBe(
      `select "latest" from orders where status = 'paid' and at >= '2026-09-01T00:00:00.000Z'`,
    );
    expect(query.params).toEqual([]);
    const aliased = db.calls[0]?.queryChunks.find((chunk): chunk is SQL.Aliased =>
      is(chunk, SQL.Aliased),
    );
    expect(aliased?.fieldAlias).toBe("latest");
    expect(compiled(aliased?.sql).params).toEqual(["2026-09-01T00:00:00.000Z"]);
  });
});
