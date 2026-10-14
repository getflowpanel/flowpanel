import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, describe, expect, it } from "vitest";
import { handlers } from "../handlers";
import { columnMoneyFactors } from "../runtime/money-field";

const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
  feeCents: integer("fee_cents").notNull(),
  total: real("total").notNull(),
});

const sqlite = new Database(":memory:");
sqlite.exec(
  "CREATE TABLE invoices (id TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL, fee_cents INTEGER NOT NULL, total REAL NOT NULL)",
);
sqlite.exec(
  "INSERT INTO invoices VALUES ('i1', 5900, 100, 59), ('i2', 7900, 250, 79), ('i3', 12000, 400, 120)",
);
afterAll(() => sqlite.close());

const config = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { invoices }, dialect: "sqlite" }),
  auth: { session: async () => ({}), role: () => "admin" },
  resources: [
    resource(invoices, {
      columns: [
        { field: "amountCents", format: { kind: "money", minorUnits: 2 } },
        "feeCents",
        { field: "total", format: "money" },
      ],
      filters: [
        { field: "amountCents", type: "numeric-range" },
        { field: "feeCents", type: "numeric-range" },
        { field: "total", type: "numeric-range" },
      ],
      create: { fields: [{ name: "feeCents", type: "money" }] },
    }),
  ],
});

async function ids(filter: string): Promise<string[]> {
  const res = await handlers(config).GET(
    new Request(`http://localhost/api/flowpanel/invoices?${filter}`),
    { params: Promise.resolve({ route: ["invoices"] }) },
  );
  const body = await res.text();
  return [...body.matchAll(/"id":"(i\d)"/g)].map((match) => match[1] ?? "").sort();
}

describe("a numeric-range filter on a money column", () => {
  it("takes its factor from the column format alone", () => {
    const resource = config.resourcesByName.get("invoices");
    if (!resource) throw new Error("fixture: invoices not registered");
    expect(columnMoneyFactors(resource)).toEqual(new Map([["amountCents", 100]]));
  });

  it("takes the amount the column shows: major units on a formatted column, raw on a plain one", async () => {
    expect(await ids("filter.amountCents=60:90")).toEqual(["i2"]);
    expect(await ids("filter.feeCents=200:300")).toEqual(["i2"]);
    expect(await ids("filter.total=60:90")).toEqual(["i2"]);
  });
});
