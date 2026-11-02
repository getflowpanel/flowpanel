import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { introspect } from "../introspect";

const roleEnum = pgEnum("role", ["admin", "user", "guest"] as const);

const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("user"),
  age: integer("age"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

describe("introspect(drizzle pg table)", () => {
  it("produces column metadata", () => {
    const meta = introspect(users);
    expect(meta.name).toBe("users");
    expect(meta.primaryKey).toBe("id");

    const byName = Object.fromEntries(meta.columns.map((c) => [c.name, c]));

    expect(byName.id).toMatchObject({
      type: "string",
      primaryKey: true,
      readable: true,
      writableOnUpdate: false,
    });
    expect(byName.email).toMatchObject({ type: "string", nullable: false, unique: true });
    expect(byName.name).toMatchObject({ type: "string", nullable: true });
    expect(byName.role).toMatchObject({ type: "enum" });
    expect(byName.role?.enumValues).toEqual(["admin", "user", "guest"]);
    expect(byName.age).toMatchObject({ type: "number", nullable: true });
    expect(byName.active).toMatchObject({ type: "boolean", nullable: false });
    expect(byName.createdAt).toMatchObject({ type: "date", nullable: false });
  });

  it("reports which columns the database fills when the insert omits them", () => {
    const byName = Object.fromEntries(introspect(users).columns.map((c) => [c.name, c]));
    expect(byName.id?.hasDefault).toBe(true);
    expect(byName.role?.hasDefault).toBe(true);
    expect(byName.active?.hasDefault).toBe(true);
    expect(byName.createdAt?.hasDefault).toBe(true);
    expect(byName.email?.hasDefault).toBe(false);
    expect(byName.name?.hasDefault).toBe(false);
  });

  it("reports a plain default value, and none for an SQL default such as now()", () => {
    const byName = Object.fromEntries(introspect(users).columns.map((c) => [c.name, c]));
    expect(byName.role?.defaultValue).toBe("user");
    expect(byName.active?.defaultValue).toBe(true);
    expect(byName.createdAt?.defaultValue).toBeUndefined();
  });

  it("memoizes per table ref: a repeated call does not re-scan the columns", () => {
    const other = pgTable("other", { id: uuid("id").primaryKey() });

    const first = introspect(users);
    expect(introspect(users)).toBe(first);
    expect(introspect(other)).not.toBe(first);
  });

  it("returns a frozen result so a shared memo entry cannot be mutated", () => {
    const meta = introspect(users);
    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(meta.columns)).toBe(true);
    expect(Object.isFrozen(meta.columns[0])).toBe(true);
  });
});

describe("introspect: composite primary keys", () => {
  it("reports every column of a table-level primaryKey, by property name", async () => {
    const { primaryKey } = await import("drizzle-orm/pg-core");
    const {
      sqliteTable,
      text: sqliteText,
      primaryKey: sqlitePrimaryKey,
    } = await import("drizzle-orm/sqlite-core");
    const memberships = pgTable(
      "memberships",
      { orgId: text("org_id").notNull(), userId: text("user_id").notNull(), role: text("role") },
      (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
    );
    const tags = sqliteTable(
      "tags",
      { postId: sqliteText("post_id").notNull(), tag: sqliteText("tag").notNull() },
      (t) => [sqlitePrimaryKey({ columns: [t.postId, t.tag] })],
    );
    expect(introspect(memberships).keyColumns).toEqual(["orgId", "userId"]);
    expect(introspect(tags).keyColumns).toEqual(["postId", "tag"]);
  });

  it("reports none for a single-column key", () => {
    const users = pgTable("users", { id: uuid("id").primaryKey(), email: text("email") });
    expect(introspect(users).keyColumns).toBeUndefined();
  });
});

describe("introspect: a SQL date column", () => {
  it("is marked date-only on PostgreSQL and MySQL, and a timestamp is not", async () => {
    const pg = await import("drizzle-orm/pg-core");
    const mysql = await import("drizzle-orm/mysql-core");
    const byName = (table: unknown) =>
      Object.fromEntries(introspect(table).columns.map((column) => [column.name, column]));
    const pgCols = byName(
      pg.pgTable("events", {
        id: pg.integer("id").primaryKey(),
        day: pg.date("day", { mode: "date" }),
        dayText: pg.date("day_text"),
        at: pg.timestamp("at"),
      }),
    );
    expect(pgCols.day).toMatchObject({ type: "date", dateOnly: true });
    expect(pgCols.dayText?.type).toBe("string");
    expect(pgCols.at?.dateOnly).toBeUndefined();
    const myCols = byName(
      mysql.mysqlTable("events", {
        id: mysql.int("id").primaryKey(),
        day: mysql.date("day"),
        at: mysql.datetime("at"),
      }),
    );
    expect(myCols.day).toMatchObject({ type: "date", dateOnly: true });
    expect(myCols.at?.dateOnly).toBeUndefined();
  });
});
