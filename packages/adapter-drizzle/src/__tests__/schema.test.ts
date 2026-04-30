import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { inferSchema } from "../schema.js";

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
