import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
}));

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import {
  type Adapter,
  type AuditEvent,
  defineAdmin,
  FlowpanelConflictError,
  resource,
} from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { bulkActionRoute } from "../actions/bulk-action";
import { publishResource } from "../runtime/publish";

const parents = sqliteTable("parents", { id: text("id").primaryKey(), name: text("name") });
const sqlite = new Database(":memory:");
afterAll(() => sqlite.close());
const audited: AuditEvent[] = [];

function admin(adapter: Adapter) {
  return defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
    audit: {
      sink: async (event: AuditEvent) => {
        audited.push(event);
      },
    },
    resources: [resource(parents, { columns: ["name"] })],
  });
}

function deleteAll(config: ReturnType<typeof admin>, ids: string[]): Promise<Response> {
  return bulkActionRoute(config)(
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
    { params: Promise.resolve({ resource: "parents", action: "delete" }) },
  );
}

const sqliteAdapter = drizzleAdapter({
  db: drizzle(sqlite),
  schema: { parents },
  dialect: "sqlite",
});
const remaining = () =>
  (sqlite.prepare("SELECT id FROM parents ORDER BY id").all() as { id: string }[]).map((r) => r.id);

beforeEach(() => {
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec("DROP TABLE IF EXISTS children; DROP TABLE IF EXISTS parents;");
  sqlite.exec("CREATE TABLE parents (id TEXT PRIMARY KEY, name TEXT)");
  sqlite.exec("CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id))");
  sqlite.exec("INSERT INTO parents VALUES ('a', 'A'), ('b', 'B'), ('c', 'C')");
  sqlite.exec("INSERT INTO children VALUES ('k', 'b')");
  audited.length = 0;
  vi.mocked(publishResource).mockClear();
});

describe("the built-in bulk delete", () => {
  it("rolls the whole selection back on better-sqlite3 when one row cannot go", async () => {
    const res = await deleteAll(admin(sqliteAdapter), ["a", "b", "c"]);
    expect(res.status).toBe(409);
    expect(remaining()).toEqual(["a", "b", "c"]);
    expect(audited).toEqual([]);
    expect(publishResource).not.toHaveBeenCalled();
  });

  it("deletes everything in one transaction when every row can go", async () => {
    sqlite.exec("DELETE FROM children");
    expect((await deleteAll(admin(sqliteAdapter), ["a", "b", "c"])).status).toBe(200);
    expect(remaining()).toEqual([]);
    expect(audited).toMatchObject([{ action: "parents.bulk.delete", targetId: "a,b,c" }]);
  });

  it("without a transaction, audits and publishes what it deleted and says what it could not", async () => {
    const noTransaction: Adapter = {
      ...sqliteAdapter,
      transaction: async () => {
        throw new Error("No transactions support in this driver");
      },
    };
    const res = await deleteAll(admin(noTransaction), ["a", "b", "c"]);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/^Deleted 1 of 3\. /);
    expect(remaining()).toEqual(["b", "c"]);
    expect(audited).toMatchObject([{ action: "parents.bulk.delete", targetId: "a" }]);
    expect(publishResource).toHaveBeenCalledWith("parents", { action: "delete" });
  });

  it("fails cleanly, deleting nothing, when the transaction cannot open on a busy database", async () => {
    const busy: Adapter = {
      ...sqliteAdapter,
      transaction: async () => {
        throw new FlowpanelConflictError("The database is busy. Try again.");
      },
    };
    const res = await deleteAll(admin(busy), ["a", "c"]);
    expect(res.status).toBe(409);
    expect(remaining()).toEqual(["a", "b", "c"]);
    expect(audited).toEqual([]);
  });
});
