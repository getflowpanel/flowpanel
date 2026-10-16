import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { type AuditLogEntry, DEFAULT_LABELS, defineAdmin, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, describe, expect, it } from "vitest";
import { auditFeedItems } from "../pages/audit/audit-feed";
import { buildRequestContext } from "../runtime/request-setup";

const orgs = sqliteTable("orgs", { id: text("id").primaryKey(), name: text("name").notNull() });
const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  orgId: text("org_id"),
});
const secrets = sqliteTable("secrets", { id: text("id").primaryKey(), name: text("name") });
const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title"),
  deletedAt: integer("deleted_at"),
});

const sqlite = new Database(":memory:");
sqlite.exec("CREATE TABLE orgs (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
sqlite.exec("CREATE TABLE members (id TEXT PRIMARY KEY, email TEXT NOT NULL, org_id TEXT)");
sqlite.exec("CREATE TABLE secrets (id TEXT PRIMARY KEY, name TEXT)");
sqlite.exec("INSERT INTO orgs VALUES ('o1', 'Acme'), ('o2', 'Globex'), ('o3', 'Org Initech')");
sqlite.exec("INSERT INTO members VALUES ('7f3a9c1e', 'ann@example.com', 'o2')");
sqlite.exec("INSERT INTO secrets VALUES ('s1', 'Vault')");
sqlite.exec("CREATE TABLE notes (id TEXT PRIMARY KEY, title TEXT, deleted_at INTEGER)");
sqlite.exec("INSERT INTO notes VALUES ('n1', 'Refund plan', 1700000000)");
afterAll(() => sqlite.close());

const config = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { orgs, members, secrets, notes } }),
  auth: { session: async () => ({ id: "me" }), role: () => "support" },
  resources: [
    resource(orgs, { columns: ["name"] }),
    resource(members, {
      columns: [
        "email",
        { field: "orgId", label: "Org", reference: { resource: "orgs", labelField: "name" } },
      ],
    }),
    resource(secrets, { columns: ["name"], access: { read: "admin" } }),
    resource(notes, {
      columns: ["title"],
      delete: { softDelete: "deletedAt" },
      access: { update: "admin" },
    }),
  ],
});

const entry = (over: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: "e1",
  actorId: "u9",
  actorName: "Ann Lee",
  action: "members.update",
  resource: "members",
  targetId: "7f3a9c1e",
  diff: { before: { orgId: "o1" }, after: { orgId: "o2" } },
  at: new Date("2026-10-09T10:00:00Z"),
  ...over,
});

async function items(entries: AuditLogEntry[]) {
  const reqCtx = await buildRequestContext({
    req: new Request("http://localhost/admin/audit-log"),
    config,
  });
  return auditFeedItems(config, reqCtx, entries, DEFAULT_LABELS.audit, { linkRecords: true });
}

describe("an audit event's record and references", () => {
  it("does not say the label twice when the record's title already starts with it", async () => {
    const [item] = await items([
      entry({ resource: "orgs", action: "orgs.update", targetId: "o3", diff: null }),
    ]);
    expect(item?.record?.label).toBe("Org Initech");
  });

  it("name a record by its email and a reference by the record it points at", async () => {
    const [item] = await items([entry({})]);
    expect(item?.record?.label).toBe("Member ann@example.com");
    expect(item?.changes.map(({ label, before, after }) => [label, before, after])).toEqual([
      ["Org", "Acme", "Globex"],
    ]);
  });

  it("keep the id of a record the reader may not read", async () => {
    const [item] = await items([
      entry({ action: "secrets.update", resource: "secrets", targetId: "s1", diff: null }),
    ]);
    expect(item?.record?.label).toBe("Secret s1");
  });

  it("keep the id of a deleted record the reader may not see deleted", async () => {
    const [item] = await items([
      entry({ action: "notes.delete", resource: "notes", targetId: "n1", diff: null }),
    ]);
    expect(item?.record?.label).toBe("Note n1");
  });
});
