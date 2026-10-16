import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineAdmin, metric, resource } from "@flowpanel/core";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterAll, describe, expect, it } from "vitest";
import { listRequestFromParams } from "../runtime/list-request";
import { listRows } from "../runtime/list-rows";
import { buildRequestContext } from "../runtime/request-setup";
import { resolveLink } from "../runtime/resolve-link";
import { wireViews } from "../runtime/saved-views";
import { buildWidgetContext, widgetHref } from "../runtime/widget-context";

const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  amountCents: integer("amount_cents").notNull(),
});

const sqlite = new Database(":memory:");
sqlite.exec("CREATE TABLE invoices (id TEXT PRIMARY KEY, amount_cents INTEGER NOT NULL)");
sqlite.exec("INSERT INTO invoices VALUES ('small', 5000), ('mid', 150000), ('big', 250000)");
afterAll(() => sqlite.close());

const LARGE = { amountCents: { gte: 100000 } };

const config = defineAdmin({
  adapter: drizzleAdapter({ db: drizzle(sqlite), schema: { invoices }, dialect: "sqlite" }),
  auth: { session: async () => ({ id: "u1" }), role: () => "admin" },
  resources: [
    resource(invoices, {
      columns: [{ field: "amountCents", format: { kind: "money", minorUnits: 2 } }],
      filters: [{ field: "amountCents", type: "numeric-range" }],
      views: [{ name: "Large", filters: LARGE }],
    }),
  ],
});

async function contexts() {
  const req = new Request("http://localhost/admin");
  const reqCtx = await buildRequestContext({ req, config });
  const range = { from: new Date(0), to: new Date(), preset: "custom" as const };
  return { reqCtx, ctx: buildWidgetContext(config, reqCtx, req, range) };
}

async function rowsAt(href: string | undefined): Promise<string[]> {
  const target = config.resourcesByName.get("invoices");
  if (!target || href === undefined) throw new Error("no link or no invoices");
  const { reqCtx } = await contexts();
  const listing = await listRequestFromParams(
    config,
    target,
    reqCtx,
    new URL(href, "http://localhost").searchParams,
  );
  const page = await listRows(config, target, reqCtx, { ...listing.query, pageSize: 50 });
  return page.rows.map((row) => String(row.id)).sort();
}

describe("a link to a money column's rows", () => {
  it("from a linked count opens the rows it counted", async () => {
    const { ctx } = await contexts();
    const card = metric("Large invoices", { count: "invoices", where: LARGE });
    expect(await card.query(ctx)).toBe(2);
    const href = resolveLink(config, ctx, card.options.drilldown);
    expect(href).toContain("f_amountCents=1000%3A");
    expect(await rowsAt(href)).toEqual(["big", "mid"]);
  });

  it("from ctx.link, widgetHref and a saved view opens the same rows", async () => {
    const { ctx } = await contexts();
    expect(await rowsAt(ctx.link({ resource: "invoices", filter: LARGE }))).toEqual(["big", "mid"]);
    expect(await rowsAt(ctx.link({ resource: "invoices", view: "Large" }))).toEqual(["big", "mid"]);
    expect(
      await rowsAt(widgetHref(config, "UTC", "invoices", undefined, { filter: LARGE })),
    ).toEqual(["big", "mid"]);
    const target = config.resourcesByName.get("invoices");
    if (!target) throw new Error("no invoices");
    expect(wireViews(target, "UTC")[0]?.filters).toEqual({ amountCents: "1000:" });
  });
});
