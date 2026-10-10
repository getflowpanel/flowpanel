import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, resource } from "@flowpanel/core";
import { AutoForm } from "@flowpanel/react";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handlers } from "../handlers";
import { ResourceCreatePage } from "../pages/resource-create";
import { ResourceEditPage } from "../pages/resource-edit";

function findElement(tree: ReactNode, type: unknown): Record<string, unknown> | null {
  if (tree === null || tree === undefined || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const c of tree) {
      const hit = findElement(c, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(tree)) return null;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === type) return el.props;
  return findElement(el.props.children, type);
}

const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull(),
  customerId: text("customer_id"),
});

const sqlite = new Database(":memory:");
const config = defineAdmin({
  adapter: drizzleAdapter({
    db: drizzle(sqlite),
    schema: { customers, orders },
    dialect: "sqlite",
  }),
  auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
  resources: [
    resource(customers, { columns: ["name"], search: ["name"] }),
    resource(orders, {
      columns: [
        "number",
        {
          field: "customerId",
          label: "Customer",
          reference: { resource: "customers", labelField: "name" },
        },
      ],
    }),
  ],
});

beforeAll(() => {
  sqlite.exec("CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL)");
  sqlite.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, number TEXT NOT NULL, customer_id TEXT)");
  sqlite.exec("INSERT INTO customers VALUES ('c1', 'Ann'), ('c2', 'Bob')");
  sqlite.exec("INSERT INTO orders VALUES ('o1', 'N-1', 'c2')");
});
afterAll(() => sqlite.close());

const ordersResource = () => {
  const found = config.resourcesByName.get("orders");
  if (!found) throw new Error("orders not registered");
  return found;
};

describe("a column reference without declared form fields", () => {
  it("renders as a picker on the generated create form", async () => {
    const tree = await ResourceCreatePage({
      config,
      resource: ordersResource(),
      name: "orders",
      req: new Request("http://localhost/admin/orders/new"),
    });
    expect(findElement(tree, AutoForm)?.columnFields).toEqual([
      { name: "customerId", label: "Customer", type: "reference", options: [] },
    ]);
  });

  it("shows the current record's label on the generated edit form", async () => {
    const tree = await ResourceEditPage({
      config,
      resource: ordersResource(),
      name: "orders",
      id: "o1",
      req: new Request("http://localhost/admin/orders/o1/edit"),
    });
    expect(findElement(tree, AutoForm)?.columnFields).toMatchObject([
      { name: "customerId", type: "reference", options: [{ value: "c2", label: "Bob" }] },
    ]);
  });

  it("is served by reference search", async () => {
    const res = await handlers(config).GET(
      new Request("http://localhost/api/flowpanel/orders/reference/customerId?q=an"),
      { params: Promise.resolve({ route: ["orders", "reference", "customerId"] }) },
    );
    expect(await res.json()).toEqual({ ok: true, options: [{ value: "c1", label: "Ann" }] });
  });
});
