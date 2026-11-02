import { decimal as mysqlDecimal, mysqlTable } from "drizzle-orm/mysql-core";
import { date, decimal, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { numeric as sqliteNumeric, sqliteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { introspect } from "../introspect";
import { inferSchema } from "../schema";

const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  age: integer("age"),
});

describe("inferSchema(drizzle table)", () => {
  it("derives create, update, select zod schemas", () => {
    const s = inferSchema(users);
    expect(s.create.safeParse({ id: "u1", email: "x@y.z" }).success).toBe(true);
    expect(s.create.safeParse({ id: "u1" }).success).toBe(false);
    expect(s.update.safeParse({}).success).toBe(true);
    expect(s.select.safeParse({ id: "u1", email: "x@y.z", age: null }).success).toBe(true);
  });
});

const orders = pgTable("orders", {
  id: integer("id").primaryKey(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount"),
  ratio: numeric("ratio", { mode: "number" }),
});
const mysqlOrders = mysqlTable("orders", { total: mysqlDecimal("total").notNull() });
const sqliteOrders = sqliteTable("orders", { total: sqliteNumeric("total").notNull() });

describe("a numeric or decimal column", () => {
  it("is a number control on every dialect", () => {
    for (const table of [orders, mysqlOrders, sqliteOrders]) {
      expect(introspect(table).columns.find((c) => c.name === "total")?.type).toBe("number");
    }
    expect(introspect(orders).columns.find((c) => c.name === "ratio")?.type).toBe("number");
  });

  it("stores numeric text as written and accepts a number from the form", () => {
    for (const table of [orders, mysqlOrders, sqliteOrders]) {
      const { create } = inferSchema(table);
      expect(create.safeParse({ id: 1, total: "12.50" }).data).toMatchObject({ total: "12.50" });
      expect(create.safeParse({ id: 1, total: 12.5 }).data).toMatchObject({ total: "12.5" });
    }
  });

  it("rejects text that is not a number as a type error", () => {
    for (const table of [orders, mysqlOrders, sqliteOrders]) {
      for (const total of ["abc", "12,50", ""]) {
        const parsed = inferSchema(table).create.safeParse({ id: 1, total });
        expect(parsed.success).toBe(false);
        expect(parsed.error?.issues[0]).toMatchObject({
          code: "invalid_type",
          expected: "number",
          path: ["total"],
        });
      }
    }
  });

  it("keeps a nullable decimal optional and an update partial", () => {
    const { create, update } = inferSchema(orders);
    expect(create.safeParse({ id: 1, total: "1", discount: null }).success).toBe(true);
    expect(create.safeParse({ id: 1, total: "1" }).success).toBe(true);
    expect(create.safeParse({ id: 1 }).success).toBe(false);
    expect(update.safeParse({ discount: "0.5" }).data).toEqual({ discount: "0.5" });
    expect(update.safeParse({ total: "x" }).success).toBe(false);
  });
});

const events = pgTable("events", {
  id: integer("id").primaryKey(),
  at: timestamp("at").notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  day: date("day", { mode: "date" }),
  label: date("label"),
});

describe("a date column", () => {
  it("takes the ISO text a JSON body or an inline edit sends, as a Date", () => {
    const { create, update } = inferSchema(events);
    const parsed = create.safeParse({ id: 1, at: "2026-10-18T22:30:00.000Z", day: "2026-10-18" });
    expect(parsed.success).toBe(true);
    expect((parsed.data as { at: Date }).at).toEqual(new Date("2026-10-18T22:30:00.000Z"));
    expect((parsed.data as { day: Date }).day).toEqual(new Date("2026-10-18T00:00:00.000Z"));
    expect(update.safeParse({ endedAt: null }).data).toEqual({ endedAt: null });
    expect(update.safeParse({}).data).toEqual({});
    expect(update.safeParse({ at: "not a date" }).success).toBe(false);
    expect(update.safeParse({ label: "2026-10-18" }).data).toEqual({ label: "2026-10-18" });
  });
});

describe("a date column, strictly", () => {
  const { update } = inferSchema(events);

  it("refuses null on NOT NULL, and a number, a boolean or text without a zone anywhere", () => {
    for (const value of [null, true, 0, "1", "2026-10-18T22:30", "soon"]) {
      expect(update.safeParse({ at: value }).success).toBe(false);
    }
    expect(update.safeParse({ endedAt: null }).data).toEqual({ endedAt: null });
    expect(update.safeParse({ endedAt: 0 }).success).toBe(false);
  });

  it("takes a Date, ISO 8601 text with an offset, or a calendar day", () => {
    for (const value of [
      new Date("2026-10-18T22:30:00Z"),
      "2026-10-18T22:30:00Z",
      "2026-10-19T01:30:00+03:00",
    ]) {
      expect(update.safeParse({ at: value }).data).toEqual({
        at: new Date("2026-10-18T22:30:00Z"),
      });
    }
    expect(update.safeParse({ day: "2026-10-18" }).data).toEqual({
      day: new Date("2026-10-18T00:00:00Z"),
    });
  });
});
