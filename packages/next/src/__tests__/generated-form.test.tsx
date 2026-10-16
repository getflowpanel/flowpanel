import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, resource } from "@flowpanel/core";
import { AutoForm } from "@flowpanel/react";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { handlers } from "../handlers";
import { ResourceCreatePage } from "../pages/resource-create";
import { ResourceEditPage } from "../pages/resource-edit";

function findProps(tree: ReactNode, type: unknown): Record<string, unknown> | null {
  if (tree === null || tree === undefined || typeof tree !== "object") return null;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const hit = findProps(child, type);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(tree)) return null;
  const element = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (element.type === type) return element.props;
  return findProps(element.props.children, type);
}

const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull(),
  status: text("status", { enum: ["draft", "paid"] })
    .notNull()
    .default("draft"),
  totalCents: integer("total_cents").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  dueOn: integer("due_on", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

const sqlite = new Database(":memory:");
const config = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { orders }, dialect: "sqlite" }),
  auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
  resources: [
    resource(orders, {
      columns: [
        "number",
        "status",
        { field: "totalCents", label: "Total", format: { kind: "money", minorUnits: 2 } },
        "createdAt",
        "dueOn",
      ],
    }),
  ],
});

beforeAll(() => {
  sqlite.exec(
    "CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', total_cents INTEGER NOT NULL, note TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch()), due_on INTEGER NOT NULL DEFAULT (unixepoch()))",
  );
  sqlite.exec("INSERT INTO orders (number, status, total_cents) VALUES ('A-1', 'paid', 7435)");
});
afterAll(() => sqlite.close());

const ordersResource = () => {
  const found = config.resourcesByName.get("orders");
  if (!found) throw new Error("orders not registered");
  return found;
};

type Control = { name: string; type: string; label: string; required?: boolean };

async function createControls(): Promise<{ fields: Control[]; columns: { name: string }[] }> {
  const tree = await ResourceCreatePage({
    config,
    resource: ordersResource(),
    name: "orders",
    req: new Request("http://localhost/admin/orders/new"),
  });
  const props = findProps(tree, AutoForm);
  return {
    fields: props?.columnFields as Control[],
    columns: props?.columns as { name: string }[],
  };
}

describe("a create form no fields declare", () => {
  it("edits a money column in major units, labelled as its column", async () => {
    const { fields } = await createControls();
    expect(fields.find((field) => field.name === "totalCents")).toMatchObject({
      type: "money",
      label: "Total",
      required: true,
    });
  });

  it("marks what the database needs and starts a defaulted column at its default", async () => {
    const { fields } = await createControls();
    expect(fields.find((field) => field.name === "number")?.required).toBe(true);
    expect(fields.find((field) => field.name === "note")?.required).toBeUndefined();
    expect(fields.find((field) => field.name === "status")).toMatchObject({
      type: "select",
      defaultValue: "draft",
    });
    expect(fields.find((field) => field.name === "status")?.required).toBeUndefined();
  });

  it("leaves out a timestamp the database fills", async () => {
    const { fields, columns } = await createControls();
    expect(fields.map((field) => field.name)).not.toContain("createdAt");
    expect(columns.map((column) => column.name)).not.toContain("createdAt");
  });

  it("keeps a defaulted date the user sets, such as a due date, as an optional field", async () => {
    const { fields } = await createControls();
    const due = fields.find((field) => field.name === "dueOn");
    expect(due).toMatchObject({ type: "datetime" });
    expect(due?.required).toBeUndefined();
  });

  it("stores a typed amount in the column's minor units", async () => {
    const body = new FormData();
    body.set("number", "A-2");
    body.set("status", "draft");
    body.set("totalCents", "19.99");
    const res = await handlers(config).POST(
      new Request("http://localhost/api/flowpanel/orders/create", {
        method: "POST",
        headers: { origin: "http://localhost" },
        body,
      }),
      { params: Promise.resolve({ route: ["orders", "create"] }) },
    );
    expect(res.status).toBeLessThan(400);
    expect(sqlite.prepare("SELECT total_cents FROM orders WHERE number = 'A-2'").get()).toEqual({
      total_cents: 1999,
    });
  });
});

describe("an edit form no fields declare", () => {
  it("shows a stored amount in major units", async () => {
    const tree = await ResourceEditPage({
      config,
      resource: ordersResource(),
      name: "orders",
      id: "1",
      req: new Request("http://localhost/admin/orders/1/edit"),
    });
    const defaults = findProps(tree, AutoForm)?.defaultValues as
      | Record<string, unknown>
      | undefined;
    expect(defaults?.totalCents).toBe("74.35");
  });
});
