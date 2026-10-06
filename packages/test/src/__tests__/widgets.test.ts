import {
  type Adapter,
  type ColumnMeta,
  custom,
  type DetailHeaderContext,
  defineAdmin,
  kv,
  metric,
  resource,
  type WidgetConfig,
  type WidgetContext,
} from "@flowpanel/kit";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { headerContext, resolveWidget, type WidgetContextOptions, widgetContext } from "../widgets";

const PAYMENTS = [
  { id: "p1", status: "paid", amount: 10, paidAt: new Date("2026-09-20T10:00:00Z") },
  { id: "p2", status: "paid", amount: 30, paidAt: new Date("2026-09-24T10:00:00Z") },
  { id: "p3", status: "open", amount: 5, paidAt: null },
];
const WEEK = { from: new Date("2026-09-22T00:00:00Z"), to: new Date("2026-09-25T00:00:00Z") };
const param = (link: string, key: string) => new URL(link, "http://x").searchParams.get(key);

function Conveyor(_props: { stages: number; failed: string }) {
  return null;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("widgetContext without an admin", () => {
  it("builds under NODE_ENV=production, where an open writable admin is refused", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await widgetContext({ rows: { payment: PAYMENTS } }).count("payment")).toBe(3);
  });
});

describe("widgetContext reads", () => {
  it("hands dashboard filters to the widget", () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS }, filters: { site: "ebay" } });
    expect(ctx.filters.site).toBe("ebay");
    expect(widgetContext({ rows: { payment: PAYMENTS } }).filters).toEqual({});
  });

  it("reads a zoneless timestamp as UTC, as the SQL adapters do, in any process zone", async () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const late = [{ id: "v1", at: "2026-09-21 23:30:00" }];
      const ctx = widgetContext({ rows: { visit: late }, range: WEEK });
      expect(await ctx.count("visit", {}, { range: "at" })).toBe(0);
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("counts by value, range, set and bounds, as the admin does", async () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS }, range: WEEK });
    expect(await ctx.count("payment", { status: "paid" })).toBe(2);
    expect(await ctx.count("payment", { status: "paid" }, { range: "paidAt" })).toBe(1);
    expect(await ctx.count("payment", { paidAt: "__null__" })).toBe(1);
    expect(await ctx.count("payment", { status: ["paid", "open"] })).toBe(3);
    expect(await ctx.count("payment", { amount: { gte: 10 } })).toBe(2);
  });

  it("counts 0 for an undefined or null value, and read refuses both", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = widgetContext({ rows: { payment: PAYMENTS } });
    expect(await ctx.count("payment", { status: undefined })).toBe(0);
    expect(await ctx.count("payment", { status: null })).toBe(0);
    await expect(ctx.read("payment", { where: { status: undefined } })).rejects.toThrow(
      'filters "status" by undefined',
    );
  });

  it("names the field and the resource that were probably meant", async () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS } });
    await expect(ctx.count("payment", { stauts: "paid" })).rejects.toThrow(
      'Did you mean "status"?',
    );
    await expect(ctx.count("paymnt")).rejects.toThrow('Did you mean "payment"?');
  });

  it("reads rows sorted and limited", async () => {
    const rows = await widgetContext({ rows: { payment: PAYMENTS } }).read("payment", {
      where: { status: "paid" },
      sort: { field: "amount", dir: "desc" },
      limit: 1,
    });
    expect(rows).toEqual([PAYMENTS[1]]);
  });

  it("answers ctx.sql with the statement and its values", async () => {
    const seen: unknown[] = [];
    const ctx = widgetContext({
      sql: (query) => {
        seen.push(query);
        return [{ n: 3 }];
      },
    });
    const since = new Date("2026-09-01T00:00:00Z");
    expect(await ctx.sql`select count(*) as n from runs where started_at >= ${since}`).toEqual([
      { n: 3 },
    ]);
    expect(seen).toEqual([
      { text: "select count(*) as n from runs where started_at >= $1", values: [since] },
    ]);
  });

  it("refuses a ctx.sql it was given no answer for", async () => {
    await expect(widgetContext().sql`select 1`).rejects.toThrow('ctx.sql ran "select 1"');
  });

  it("calls ctx.query(fn) with the context, as the admin does", async () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS } });
    const paid = (c: WidgetContext) => c.count("payment", { status: "paid" });
    expect(await ctx.query(paid)).toBe(2);
  });
});

describe("widgetContext links", () => {
  it("writes filters, sets, tabs and the range as the admin's lists read them", () => {
    const ctx = widgetContext({
      rows: { payment: PAYMENTS },
      range: WEEK,
      paths: { admin: "/new-admin" },
    });
    expect(ctx.link({ resource: "payment", filter: { status: "paid" } })).toBe(
      "/new-admin/payment?f_status=paid",
    );
    expect(
      param(ctx.link({ resource: "payment", filter: { status: ["paid", "open"] } }), "f_status"),
    ).toBe("paid,open");
    expect(ctx.link({ resource: "payment", id: "p1", tab: "history" })).toBe(
      "/new-admin/payment/p1?tab=history",
    );
    expect(param(ctx.link({ resource: "payment", range: "paidAt" }), "f_paidAt")).toBe(
      "2026-09-22T00:00:00.000Z~2026-09-25T00:00:00.000Z",
    );
  });

  it("names the resource a link was probably meant for", () => {
    expect(() => widgetContext({ rows: { payment: [] } }).link({ resource: "paymnt" })).toThrow(
      'Did you mean "payment"?',
    );
  });
});

describe("widgetContext on a record", () => {
  it("hands the record to rowOf and names both resources on a mismatch", () => {
    const ctx = widgetContext({ resource: "user", row: { id: 7, name: "Ada" } });
    expect(ctx.id).toBe("7");
    expect(ctx.rowOf("user")).toEqual({ id: 7, name: "Ada" });
    expect(() => ctx.rowOf("order")).toThrow('sits on a "user" card');
    expect(() => widgetContext().rowOf("user")).toThrow("has no record");
  });
});

describe("widgetContext over your own admin", () => {
  const column = (name: string): ColumnMeta => ({
    name,
    type: "string",
    nullable: true,
    unique: false,
    primaryKey: name === "id",
  });
  const database: Adapter = {
    kind: "drizzle",
    db: null,
    introspect: () => ({
      name: "invoice",
      columns: ["id", "status", "customerId"].map(column),
      primaryKey: "id",
    }),
    inferSchema: () => ({}) as never,
    list: async () => {
      throw new Error("the real database is never read");
    },
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  const admin = defineAdmin({
    adapter: database,
    auth: { session: async () => null, role: () => "admin", requireRole: "admin" },
    paths: { admin: "/ops" },
    resources: [
      resource(
        { __name: "invoice" },
        { columns: ["id", "status"], views: [{ name: "Unpaid", filters: { status: "open" } }] },
      ),
    ],
  });

  it("links a record header under the admin's own mount", () => {
    expect(headerContext({ admin }).link({ resource: "invoice", id: 7 })).toBe("/ops/invoice/7");
  });

  it("keeps the admin's mount, views and columns, and reads only the rows you pass", async () => {
    const ctx = widgetContext({ admin, rows: { invoice: [{ id: "i1", status: "paid" }] } });
    expect(ctx.link({ resource: "invoice", view: "Unpaid" })).toBe("/ops/invoice?f_status=open");
    expect(await ctx.count("invoice", { status: "paid" })).toBe(1);
    expect(await ctx.count("invoice", { customerId: "c1" })).toBe(0);
    await expect(ctx.count("invoice", { customerID: "c1" })).rejects.toThrow(
      'Did you mean "customerId"?',
    );
  });
});

describe("resolveWidget from @flowpanel/test/widgets", () => {
  it("resolves a count metric to its number and the rows it counted", async () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS } });
    const widget = metric("Paid", { count: "payment", where: { status: "paid" } });
    const { kind, props } = await resolveWidget(widget, ctx);
    expect(kind).toBe("metric");
    expect(props).toMatchObject({
      label: "Paid",
      value: 2,
      drilldown: "/admin/payment?f_status=paid",
    });
  });

  it("compares a period with the one before it, over the same rows", async () => {
    const ctx = widgetContext({ rows: { payment: PAYMENTS }, range: WEEK });
    const widget = metric(
      "Paid",
      { count: "payment", where: { status: "paid" }, range: "paidAt" },
      { compare: true },
    );
    const { props } = await resolveWidget(widget, ctx);
    expect(props.value).toBe(1);
    expect(props.delta).toMatchObject({ previous: 1 });
  });

  it("resolves kv items through the record", async () => {
    const ctx = widgetContext({ resource: "user", row: { id: 1, email: "ada@example.com" } });
    const widget = kv({
      label: "Profile",
      items: [{ label: "Email", value: async (c) => String(c.rowOf("user").email) }],
    });
    const { props } = await resolveWidget(widget, ctx);
    expect(props.items).toEqual([
      expect.objectContaining({ label: "Email", value: "ada@example.com" }),
    ]);
  });

  it("returns a custom widget's props, with links under the admin's mount", async () => {
    const widget = custom(Conveyor, async (c) => ({
      stages: await c.count("payment"),
      failed: c.link({ resource: "payment", filter: { status: "open" } }),
    }));
    const ctx = widgetContext({ rows: { payment: PAYMENTS } });
    const { props } = await resolveWidget(widget as WidgetConfig, ctx);
    expect(props).toEqual({ stages: 3, failed: "/admin/payment?f_status=open" });
  });

  it("types its options and its context", () => {
    expectTypeOf(widgetContext).parameter(0).toEqualTypeOf<WidgetContextOptions | undefined>();
    expectTypeOf(widgetContext()).toEqualTypeOf<WidgetContext>();
  });
});

describe("headerContext", () => {
  it("hands a record header the admin's formatters, strings and links", () => {
    const ctx = headerContext({ formatting: { locale: "ru-RU", timeZone: "UTC" } });
    expect(ctx.format.date(new Date("2026-09-20T10:00:00Z"))).toBe("20.09.2026");
    expect(ctx.labels.searchPlaceholder).toBe("Поиск: {label}…");
    expectTypeOf(ctx).toEqualTypeOf<DetailHeaderContext>();
  });
});
