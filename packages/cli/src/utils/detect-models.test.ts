import { describe, it, expect } from "vitest";
import { parsePrismaModels, parseDrizzleModels } from "./detect-models";

describe("parsePrismaModels", () => {
  it("extracts model names from a Prisma schema", () => {
    const schema = `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id @default(autoincrement())
  email String @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  content  String?
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}

enum Role {
  USER
  ADMIN
}
`;
    const models = parsePrismaModels(schema);
    expect(models).toEqual(["User", "Post"]);
  });

  it("returns empty array for schema with no models", () => {
    const schema = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;
    expect(parsePrismaModels(schema)).toEqual([]);
  });

  it("ignores enum declarations", () => {
    const schema = `
enum Status {
  ACTIVE
  INACTIVE
}
model User {
  id Int @id
}
`;
    expect(parsePrismaModels(schema)).toEqual(["User"]);
  });

  it("handles models with no spacing variations", () => {
    const schema = `model Foo{
  id Int @id
}

model   Bar   {
  id Int @id
}`;
    expect(parsePrismaModels(schema)).toEqual(["Foo", "Bar"]);
  });
});

describe("parseDrizzleModels", () => {
  it("extracts table names from pgTable declarations", () => {
    const schema = `
import { pgTable, text, integer, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});
`;
    expect(parseDrizzleModels(schema)).toEqual(["users", "posts"]);
  });

  it("handles sqliteTable and mysqlTable", () => {
    const schema = `
export const items = sqliteTable("items", { id: integer("id") });
export const logs = mysqlTable("logs", { id: int("id") });
`;
    expect(parseDrizzleModels(schema)).toEqual(["items", "logs"]);
  });

  it("returns empty array for file without drizzle tables", () => {
    const schema = `
export const thing = 42;
export const other = "hello";
`;
    expect(parseDrizzleModels(schema)).toEqual([]);
  });

  it("handles single-quoted table name", () => {
    const schema = `export const users = pgTable('users', {});`;
    expect(parseDrizzleModels(schema)).toEqual(["users"]);
  });
});
