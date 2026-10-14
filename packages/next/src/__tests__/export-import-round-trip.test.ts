import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(async () => {}),
  publishResource: vi.fn(async () => {}),
  bindPublisher: vi.fn(),
  subscribe: vi.fn(() => () => {}),
}));

import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";

const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  number: text("number").notNull(),
  status: text("status", { enum: ["draft", "paid"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
});

const sqlite = new Database(":memory:");
afterAll(() => sqlite.close());

function admin(locale = "en-US") {
  return defineAdmin({
    adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { invoices }, dialect: "sqlite" }),
    auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
    formatting: { locale },
    resources: [
      resource(invoices, {
        columns: [
          "number",
          { field: "status", label: "State" },
          { field: "amountCents", label: "Amount", format: { kind: "money", minorUnits: 2 } },
        ],
        create: {
          fields: [
            { name: "number" },
            { name: "status" },
            { name: "amountCents", label: "Amount", type: "money" },
          ],
        },
        export: { formats: ["csv", "json"] },
        import: { formats: ["csv", "json"], fields: ["number", "status", "amountCents"] },
      }),
    ],
  });
}

beforeEach(() => {
  sqlite.exec("DROP TABLE IF EXISTS invoices");
  sqlite.exec(
    "CREATE TABLE invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL, status TEXT NOT NULL, amount_cents INTEGER NOT NULL)",
  );
  sqlite.exec(
    "INSERT INTO invoices (number, status, amount_cents) VALUES ('A-1', 'paid', 5900), ('A-2', 'draft', 12005)",
  );
});

const origin = { origin: "http://localhost" };
const route = (...segments: string[]) => ({ params: Promise.resolve({ route: segments }) });

async function exported(format: "csv" | "json"): Promise<string> {
  const res = await handlers(admin()).GET(
    new Request(`http://localhost/api/flowpanel/export/invoices?format=${format}`, {
      headers: origin,
    }),
    route("export", "invoices"),
  );
  expect(res.status).toBe(200);
  return res.text();
}

async function imported(format: "csv" | "json", content: string, locale?: string) {
  const res = await handlers(admin(locale)).POST(
    new Request("http://localhost/api/flowpanel/invoices/import", {
      method: "POST",
      headers: { ...origin, "content-type": "application/json" },
      body: JSON.stringify({ format, content }),
    }),
    route("invoices", "import"),
  );
  return (await res.json()) as { imported: number; failed: { row: number; error: string }[] };
}

const stored = () =>
  sqlite.prepare("SELECT number, status, amount_cents FROM invoices ORDER BY id").all();

describe("an export file", () => {
  it("writes money in major units and keeps enum values raw", async () => {
    expect(await exported("csv")).toBe(
      "Number,State,Amount\r\nA-1,paid,59.00\r\nA-2,draft,120.05\r\n",
    );
    expect(JSON.parse(await exported("json"))).toEqual([
      { number: "A-1", status: "paid", amountCents: 59 },
      { number: "A-2", status: "draft", amountCents: 120.05 },
    ]);
  });

  it("imports back to the same stored amounts", async () => {
    for (const format of ["csv", "json"] as const) {
      const file = await exported(format);
      const before = stored();
      sqlite.exec("DELETE FROM invoices");
      const content =
        format === "csv" ? file.replace("Number,State,Amount", "number,status,amountCents") : file;
      expect(await imported(format, content)).toMatchObject({ imported: 2, failed: [] });
      expect(stored()).toEqual(before);
    }
  });
});

describe("an import row that fails", () => {
  const content = "number,status,amountCents\r\nA-3,void,12.345\r\n";

  it("names each field by its label, in the form's words", async () => {
    expect((await imported("csv", content)).failed).toEqual([
      {
        row: 1,
        error:
          "State must be one of the offered choices; Amount has more decimals than its currency keeps. Enter an amount like 12.50",
      },
    ]);
  });

  it("speaks the admin's language", async () => {
    const [failure] = (await imported("csv", content, "ru-RU")).failed;
    expect(failure?.error).toContain("«State»");
    expect(failure?.error).not.toMatch(/Invalid option|must be/);
  });
});

describe("a decimal money column without minorUnits", () => {
  const accounts = sqliteTable("accounts", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    balance: real("balance").notNull(),
    credit: real("credit").notNull(),
  });
  const accountsAdmin = () =>
    defineAdmin({
      adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { accounts }, dialect: "sqlite" }),
      auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
      resources: [
        resource(accounts, {
          columns: [
            "name",
            { field: "balance", format: { kind: "money", currency: "USD" } },
            { field: "credit", format: "money" },
          ],
          create: {
            fields: [{ name: "name" }, { name: "balance", type: "money" }, { name: "credit" }],
          },
          export: { formats: ["csv"] },
          import: { formats: ["csv"], fields: ["name", "balance", "credit"] },
        }),
      ],
    });

  it("exports and imports back its cents as they are", async () => {
    sqlite.exec("DROP TABLE IF EXISTS accounts");
    sqlite.exec(
      "CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, balance REAL NOT NULL, credit REAL NOT NULL)",
    );
    sqlite.exec("INSERT INTO accounts (name, balance, credit) VALUES ('Acme', 1234.56, 10.5)");
    const h = handlers(accountsAdmin());
    const file = await (
      await h.GET(
        new Request("http://localhost/api/flowpanel/export/accounts?format=csv", {
          headers: origin,
        }),
        route("export", "accounts"),
      )
    ).text();
    expect(file).toBe("Name,Balance,Credit\r\nAcme,1234.56,10.5\r\n");
    sqlite.exec("DELETE FROM accounts");
    const res = await h.POST(
      new Request("http://localhost/api/flowpanel/accounts/import", {
        method: "POST",
        headers: { ...origin, "content-type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          content: file.replace("Name,Balance,Credit", "name,balance,credit"),
        }),
      }),
      route("accounts", "import"),
    );
    expect(await res.json()).toMatchObject({ imported: 1, failed: [] });
    expect(sqlite.prepare("SELECT name, balance, credit FROM accounts").all()).toEqual([
      { name: "Acme", balance: 1234.56, credit: 10.5 },
    ]);
  });
});
