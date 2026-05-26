/**
 * Minimal Drizzle schema for the `with-clerk` example.
 *
 * Two tables — `users` and `posts` — are enough to demonstrate that
 * `withClerk({ requireRole: "admin" })` gates a real CRUD admin without
 * pulling in the SaaS-shaped complexity of `freelance-radar`.
 *
 * `users.clerkId` is the Clerk user id (`auth().userId`). The seed assigns
 * one row the "admin" role; you set `publicMetadata.role = "admin"` on the
 * matching Clerk user in the Clerk dashboard to actually open the admin.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id"),
    email: text("email").notNull(),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  }),
);

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
}));
