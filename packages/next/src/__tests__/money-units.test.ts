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
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { handlers } from "../handlers";
import { buildRequestContext } from "../runtime/request-setup";
import { resolveLink } from "../runtime/resolve-link";
import { buildWidgetContext } from "../runtime/widget-context";

const ledger = sqliteTable("ledger", {
  id: text("id").primaryKey(),
  yen: integer("yen").notNull(),
  fils: integer("fils").notNull(),
  cents: integer("cents").notNull(),
});

const sqlite = new Database(":memory:");
afterAll(() => sqlite.close());

const config = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { ledger }, dialect: "sqlite" }),
  auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
  resources: [
    resource(ledger, {
      columns: [
        "id",
        { field: "yen", format: { kind: "money", currency: "JPY", minorUnits: 0 } },
        { field: "fils", format: { kind: "money", currency: "KWD", minorUnits: 3 } },
        { field: "cents", format: { kind: "money", minorUnits: 2 } },
      ],
      filters: [
        { field: "yen", type: "numeric-range" },
        { field: "fils", type: "numeric-range" },
        { field: "cents", type: "numeric-range" },
      ],
      create: { fields: [{ name: "id" }, { name: "yen" }, { name: "fils" }, { name: "cents" }] },
      export: { formats: ["csv"] },
      import: { formats: ["csv"], fields: ["id", "yen", "fils", "cents"] },
    }),
  ],
});

beforeEach(() => {
  sqlite.exec("DROP TABLE IF EXISTS ledger");
  sqlite.exec(
    "CREATE TABLE ledger (id TEXT PRIMARY KEY, yen INTEGER NOT NULL, fils INTEGER NOT NULL, cents INTEGER NOT NULL)",
  );
  sqlite.exec(
    "INSERT INTO ledger VALUES ('refund', -1500, -2505, -12345), ('small', 300, 1005, 99), ('large', 90000, 125750, 250000)",
  );
});

const origin = { origin: "http://localhost" };
const route = (...segments: string[]) => ({ params: Promise.resolve({ route: segments }) });
const rows = () => sqlite.prepare("SELECT * FROM ledger ORDER BY id").all();

async function ids(query: string): Promise<string[]> {
  const res = await handlers(config).GET(
    new Request(`http://localhost/api/flowpanel/ledger?${query}`),
    route("ledger"),
  );
  const body = await res.text();
  return [...body.matchAll(/"id":"(\w+)"/g)].map((match) => match[1] ?? "").sort();
}

describe("money columns with minorUnits 0, 2 and 3", () => {
  it("filter by the amount they show, negatives included", async () => {
    expect(await ids("filter.yen=-2000:0")).toEqual(["refund"]);
    expect(await ids("filter.fils=-2.505:1.005")).toEqual(["refund", "small"]);
    expect(await ids("filter.cents=-123.45:-123.45")).toEqual(["refund"]);
    expect(await ids("filter.cents=0.99:")).toEqual(["large", "small"]);
  });

  it("link to the rows a stored-unit range names", async () => {
    const req = new Request("http://localhost/admin");
    const reqCtx = await buildRequestContext({ req, config });
    const ctx = buildWidgetContext(config, reqCtx, req, {
      from: new Date(0),
      to: new Date(),
      preset: "custom",
    });
    const opened = async (filter: Record<string, unknown>) => {
      const href = resolveLink(config, ctx, { resource: "ledger", filter }) ?? "";
      const params = new URL(href, "http://localhost").searchParams;
      const query = [...params].map(([key, value]) => `filter.${key.slice(2)}=${value}`);
      return ids(query.join("&"));
    };
    expect(await opened({ yen: { lte: -1500 } })).toEqual(["refund"]);
    expect(await opened({ fils: { gte: -2505, lte: 1005 } })).toEqual(["refund", "small"]);
    expect(await opened({ cents: { lte: -1 } })).toEqual(["refund"]);
  });

  it("export and import back the stored amounts exactly", async () => {
    const h = handlers(config);
    const file = await (
      await h.GET(
        new Request("http://localhost/api/flowpanel/export/ledger?format=csv", { headers: origin }),
        route("export", "ledger"),
      )
    ).text();
    expect(file).toContain("refund,-1500,-2.505,-123.45");
    expect(file).toContain("small,300,1.005,0.99");
    const before = rows();
    sqlite.exec("DELETE FROM ledger");
    const res = await h.POST(
      new Request("http://localhost/api/flowpanel/ledger/import", {
        method: "POST",
        headers: { ...origin, "content-type": "application/json" },
        body: JSON.stringify({
          format: "csv",
          content: file.replace(/^[^\r\n]*/, "id,yen,fils,cents"),
        }),
      }),
      route("ledger", "import"),
    );
    expect(await res.json()).toMatchObject({ imported: 3, failed: [] });
    expect(rows()).toEqual(before);
  });
});
