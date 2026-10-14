import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import {
  type AuditEvent,
  allTenants,
  defineAdmin,
  type RequestContext,
  resource,
} from "@flowpanel/core";
import Database from "better-sqlite3";
import { eq, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";
import { auditReadFilter } from "../runtime/audit-view";

const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  status: text("status"),
  orgId: integer("org_id").notNull(),
});

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);
const auditDb = new Database(":memory:");
const auditAdapter = drizzleAdapter({
  db: drizzle(auditDb),
  schema: { probe: sqliteTable("probe", { id: text("id").primaryKey() }) },
  dialect: "sqlite",
});
afterAll(() => {
  sqlite.close();
  auditDb.close();
});

type Actor = { userId: string; role: string; orgId: number | null };
const ALICE: Actor = { userId: "alice", role: "admin", orgId: null };
const BOB: Actor = { userId: "bob", role: "support", orgId: 1 };
const CAROL: Actor = { userId: "carol", role: "support", orgId: 2 };
let actor: Actor = ALICE;
const audited: AuditEvent[] = [];
const orgOf = (scope: unknown) => (scope as { orgId: number }).orgId;

const config = defineAdmin({
  adapter: drizzleAdapter({ db, schema: { tickets }, dialect: "sqlite" }),
  auth: {
    session: async () => actor,
    role: (session) => (session as Actor).role,
    access: ({ session }) => session !== null,
    userId: (session) => (session as Actor).userId,
  },
  scope: async ({ session }) => {
    const orgId = (session as Actor).orgId;
    return orgId === null ? allTenants : { orgId };
  },
  audit: {
    sink: async (event: AuditEvent) => {
      audited.push(event);
      await auditAdapter.auditLog?.append(event);
    },
  },
  resources: [
    resource(tickets, {
      columns: [{ field: "subject" }, { field: "status", editable: true }, "orgId"],
      scope: (scope, query: { where(condition: SQL): unknown }) =>
        query.where(eq(tickets.orgId, orgOf(scope))),
      scopeOf: (row) => ({ orgId: row.orgId }),
      bulkActions: [{ key: "resolve", label: "Resolve", run: async () => ({ ok: true }) }],
    }),
  ],
});

const TEMPLATE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../cli/src/templates/migration.sqlite.sql.txt",
);

beforeEach(async () => {
  sqlite.exec("DROP TABLE IF EXISTS tickets");
  sqlite.exec(
    "CREATE TABLE tickets (id TEXT PRIMARY KEY, subject TEXT NOT NULL, status TEXT, org_id INTEGER NOT NULL)",
  );
  sqlite.exec(
    "INSERT INTO tickets VALUES ('t1', 'Login', 'open', 1), ('t2', 'Invoice', 'open', 1), ('t3', 'Export', 'open', 2)",
  );
  await auditAdapter.applyMigration?.("0001_init", readFileSync(TEMPLATE, "utf8"));
  auditDb.exec("DELETE FROM flowpanel_audit_log");
  audited.length = 0;
  actor = ALICE;
});

const h = () => handlers(config);
const route = (...segments: string[]) => ({ params: Promise.resolve({ route: segments }) });
const send = (method: string, body?: unknown) =>
  new Request("http://localhost/api/flowpanel/x", {
    method,
    headers: { origin: "http://localhost", "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function listedIds(): Promise<string[]> {
  const res = await h().GET(send("GET"), route("tickets"));
  const body = await res.text();
  return [...body.matchAll(/"id":"(t\d)"/g)].map((match) => match[1] ?? "").sort();
}

async function auditSeenBy(reader: Actor): Promise<string[]> {
  const reqCtx: RequestContext = {
    req: new Request("http://localhost/admin/audit-log"),
    session: reader,
    role: reader.role,
    scope: reader.orgId === null ? allTenants : { orgId: reader.orgId },
    ip: null,
    userAgent: null,
  };
  const bound = await auditReadFilter(config, reqCtx);
  const page = await auditAdapter.auditLog?.list({ ...bound, limit: 50, offset: 0 });
  return (page?.entries ?? []).map((entry) => `${entry.actorId}:${entry.targetId}`).sort();
}

describe("staff whose scope is allTenants", () => {
  it("list every tenant's rows, while a bound user lists only their own", async () => {
    expect(await listedIds()).toEqual(["t1", "t2", "t3"]);
    actor = BOB;
    expect(await listedIds()).toEqual(["t1", "t2"]);
  });

  it("file an edit under the tenant of the row, so that tenant's staff see it", async () => {
    const res = await h().PATCH(send("PATCH", { status: "closed" }), route("tickets", "t3"));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(audited.map((event) => event.scope)).toEqual([{ orgId: 2 }]);
    expect(await auditSeenBy(CAROL)).toEqual(["alice:t3"]);
    expect(await auditSeenBy(BOB)).toEqual([]);
  });

  it("split a bulk action across tenants into one event per tenant", async () => {
    const res = await h().POST(
      send("POST", { ids: ["t1", "t3"] }),
      route("tickets", "bulk-actions", "resolve"),
    );
    expect(res.status, await res.clone().text()).toBe(200);
    expect(audited.map((event) => [event.scope, event.targetIds])).toEqual([
      [{ orgId: 1 }, ["t1"]],
      [{ orgId: 2 }, ["t3"]],
    ]);
    expect(await auditSeenBy(BOB)).toEqual(["alice:t1"]);
  });

  it("file a row they move between tenants under both", async () => {
    const res = await h().PATCH(send("PATCH", { orgId: 1 }), route("tickets", "t3"));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(audited.map((event) => event.scope)).toEqual([{ orgId: 2 }, { orgId: 1 }]);
    expect(await auditSeenBy(CAROL)).toEqual(["alice:t3"]);
    expect(await auditSeenBy(BOB)).toEqual(["alice:t3"]);
  });

  it("file a delete under the tenant the row had", async () => {
    const res = await h().DELETE(send("DELETE"), route("tickets", "t1"));
    expect(res.status, await res.clone().text()).toBe(200);
    expect(audited.map((event) => event.scope)).toEqual([{ orgId: 1 }]);
  });

  it("read every tenant's events, a bound user only their tenant's", async () => {
    await h().PATCH(send("PATCH", { status: "closed" }), route("tickets", "t3"));
    actor = BOB;
    await h().PATCH(send("PATCH", { status: "closed" }), route("tickets", "t1"));
    expect(await auditSeenBy(ALICE)).toEqual(["alice:t3", "bob:t1"]);
    expect(await auditSeenBy(BOB)).toEqual(["bob:t1"]);
    expect(await auditSeenBy(CAROL)).toEqual(["alice:t3"]);
  });
});

describe("a bound user's predicate", () => {
  it("still refuses to run when it adds no condition", async () => {
    const open = defineAdmin({
      adapter: drizzleAdapter({ db, schema: { tickets }, dialect: "sqlite" }),
      auth: { session: async () => BOB, role: () => "support" },
      scope: async () => ({ orgId: 1 }),
      resources: [resource(tickets, { columns: ["subject"], scope: (_scope, query) => query })],
    });
    const res = await handlers(open).GET(send("GET"), route("tickets"));
    expect(res.status).toBe(403);
  });
});
