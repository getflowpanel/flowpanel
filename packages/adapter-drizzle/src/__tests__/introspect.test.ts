import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { introspect } from "../introspect.js";

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

    expect(byName.id).toMatchObject({ type: "string", primaryKey: true });
    expect(byName.email).toMatchObject({ type: "string", nullable: false, unique: true });
    expect(byName.name).toMatchObject({ type: "string", nullable: true });
    expect(byName.role).toMatchObject({ type: "enum" });
    expect(byName.role?.enumValues).toEqual(["admin", "user", "guest"]);
    expect(byName.age).toMatchObject({ type: "number", nullable: true });
    expect(byName.active).toMatchObject({ type: "boolean", nullable: false });
    expect(byName.createdAt).toMatchObject({ type: "date", nullable: false });
  });
});
