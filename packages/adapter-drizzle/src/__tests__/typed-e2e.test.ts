import { defineResource } from "@flowpanel/core";
import { type InferSelectModel, relations } from "drizzle-orm";
import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
// Importing the adapter registers the inferMetadata bridge on globalThis.
import "../index";

const plan = pgEnum("plan", ["free", "pro"]);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  plan: plan("plan").notNull().default("free"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
});

const jobsRelations = relations(jobs, ({ one }) => ({
  category: one(categories, { fields: [jobs.categoryId], references: [categories.id] }),
}));

describe("defineResource accepts a Drizzle table (via inferMetadata bridge)", () => {
  it("builds columns, filters, and actions from a table + selectors", () => {
    type UserRow = InferSelectModel<typeof users>;
    const r = defineResource<UserRow>(users, {
      columns: (u) => [u.id, u.email, u.plan, u.createdAt],
      filters: (u) => [u.plan, u.createdAt],
      actions: {
        promote: { type: "row", label: "Promote", run: () => {} },
      },
    });

    expect(r.model).toBe("users");
    expect(r.primaryKey).toBe("id");
    expect(r.columns.map((c) => c.id)).toEqual(["id", "email", "plan", "createdAt"]);
    expect(r.filters.find((f) => f.id === "plan")?.mode).toBe("enum");
    expect(r.filters.find((f) => f.id === "createdAt")?.mode).toBe("dateRange");
    expect(r.actions.promote?.type).toBe("row");
  });

  it("surfaces relations when schema is registered via drizzleAdapter", async () => {
    const { drizzleAdapter } = await import("../index");
    // Schema wiring happens as a side effect of calling drizzleAdapter({schema}).
    drizzleAdapter({
      db: () => Promise.resolve({} as never),
      schema: { users, categories, jobs, jobsRelations },
    });

    type JobRow = InferSelectModel<typeof jobs> & { category: { id: number; name: string } | null };
    const r = defineResource<JobRow>(jobs, {
      columns: (j) => [j.id, j.title, j.category],
      filters: (j) => [j.category],
    });

    // `category` comes from the relations() declaration, not a plain column.
    expect(r.columns.map((c) => c.id)).toContain("category");
    expect(r.filters[0]!.mode).toBe("relation");
  });
});
