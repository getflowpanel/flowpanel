import { describe, it, expect } from "vitest";
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { buildModelMetadata } from "../metadata";

describe("Drizzle metadata — relations", () => {
  const users = pgTable("users", {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
  });
  const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    authorId: integer("author_id")
      .references(() => users.id)
      .notNull(),
  });
  const postsRelations = relations(posts, ({ one }) => ({
    author: one(users, { fields: [posts.authorId], references: [users.id] }),
  }));
  const usersRelations = relations(users, ({ many }) => ({
    posts: many(posts),
  }));

  const schema = { users, posts, postsRelations, usersRelations };

  it("populates relationModel on one-to-one relation field", () => {
    const meta = buildModelMetadata(schema, "posts");
    const authorField = meta.fields.find((f) => f.name === "author");
    expect(authorField).toBeDefined();
    expect(authorField!.kind).toBe("relation");
    expect(authorField!.relationModel).toBe("users");
    expect(authorField!.isList).toBe(false);
  });

  it("populates relationModel on one-to-many relation field", () => {
    const meta = buildModelMetadata(schema, "users");
    const postsField = meta.fields.find((f) => f.name === "posts");
    expect(postsField).toBeDefined();
    expect(postsField!.kind).toBe("relation");
    expect(postsField!.isList).toBe(true);
    expect(postsField!.relationModel).toBe("posts");
  });

  it("preserves scalar fields alongside relation fields", () => {
    const meta = buildModelMetadata(schema, "posts");
    expect(meta.fields.find((f) => f.name === "title")).toBeDefined();
    expect(meta.fields.find((f) => f.name === "id")).toBeDefined();
  });

  it("throws for unknown table key", () => {
    expect(() => buildModelMetadata(schema, "nonexistent")).toThrow();
  });
});
