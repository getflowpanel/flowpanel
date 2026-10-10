import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { eq, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { inlineUpdateRoute } from "../actions/inline-update";
import { handlers } from "../handlers";

const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  tenantId: text("tenant_id").notNull(),
});

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);

const config = defineAdmin({
  adapter: drizzleAdapter({ db, schema: { orders }, dialect: "sqlite" }),
  auth: {
    session: async () => ({ id: "u1", tenantId: "A" }),
    role: () => "admin",
    access: ({ session }) => session !== null,
  },
  scope: async () => ({ tenantId: "A" }),
  resources: [
    resource(orders, {
      columns: ["number", { field: "tenantId", editable: true }],
      scope: (scope, query: { where(condition: SQL): unknown }) =>
        query.where(eq(orders.tenantId, (scope as { tenantId: string }).tenantId)),
      create: {
        fields: [
          { name: "number" },
          { name: "tenantId", type: "hidden", hidden: true, defaultValue: () => "A" },
        ],
      },
    }),
  ],
});

function storedRow(id: string) {
  return sqlite.prepare("SELECT number, tenant_id FROM orders WHERE id = ?").get(id);
}

beforeAll(() => {
  sqlite.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, number TEXT NOT NULL, tenant_id TEXT)");
  sqlite.exec("INSERT INTO orders VALUES ('o1', 'A-1', 'A'), ('o2', 'A-2', 'A')");
});

afterAll(() => sqlite.close());

describe("a tenant cannot move its rows into another tenant", () => {
  it("refuses a JSON PATCH that sets the tenant column and leaves the row unchanged", async () => {
    const res = await handlers(config).PATCH(
      new Request("http://localhost/api/flowpanel/orders/o1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: "A-1 moved", tenantId: "B" }),
      }),
      { params: Promise.resolve({ route: ["orders", "o1"] }) },
    );
    expect(res.status).toBe(403);
    expect(storedRow("o1")).toEqual({ number: "A-1", tenant_id: "A" });
  });

  it("refuses an inline edit of the tenant column and leaves the row unchanged", async () => {
    const res = await inlineUpdateRoute(config)(
      new Request("http://localhost/api/flowpanel/orders/o2/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field: "tenantId", value: "B" }),
      }),
      { params: Promise.resolve({ resource: "orders", id: "o2" }) },
    );
    expect(res.status).toBe(403);
    expect(storedRow("o2")).toEqual({ number: "A-2", tenant_id: "A" });
  });

  it("still saves a PATCH that keeps the row in its tenant", async () => {
    const res = await handlers(config).PATCH(
      new Request("http://localhost/api/flowpanel/orders/o1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ number: "A-1 renamed" }),
      }),
      { params: Promise.resolve({ route: ["orders", "o1"] }) },
    );
    expect(res.status).toBe(200);
    expect(storedRow("o1")).toEqual({ number: "A-1 renamed", tenant_id: "A" });
  });
});
