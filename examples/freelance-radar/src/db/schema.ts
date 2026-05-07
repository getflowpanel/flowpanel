/**
 * Drizzle schema for a realistic freelance-radar SaaS.
 *
 * Covers the hard cases FlowPanel must handle end-to-end:
 *   - enums (`jobPlatform`, `paymentStatus`, `aiProvider`)
 *   - self-referential FK (`categories.parentId`)
 *   - one-to-many (`users → payments`, `users → aiCosts`)
 *   - category tree (`categories → jobs`)
 *   - JSON columns (`payments.meta`, `jobs.meta`)
 *   - timestamps as Unix integers (display/format pressure)
 */

import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const subscriptionPlan = pgEnum("subscription_plan", ["free", "pro", "team"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "active",
  "past_due",
  "canceled",
  "trialing",
]);
export const jobPlatform = pgEnum("job_platform", [
  "upwork",
  "fl_ru",
  "kwork",
  "telegram",
  "linkedin",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "canceled",
  "refunded",
]);
export const aiProvider = pgEnum("ai_provider", ["openai", "anthropic", "gemini"]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    telegramId: text("telegram_id"),
    plan: subscriptionPlan("plan").notNull().default("free"),
    status: subscriptionStatus("status").notNull().default("trialing"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    tgIdx: index("users_tg_idx").on(t.telegramId),
  }),
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => categories.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    platform: jobPlatform("platform").notNull(),
    categoryId: integer("category_id").references(() => categories.id),
    priceUsd: integer("price_usd"),
    url: text("url").notNull(),
    postedAt: timestamp("posted_at").notNull(),
    archived: boolean("archived").notNull().default(false),
    meta: jsonb("meta").$type<{
      skills?: string[];
      clientRating?: number;
      country?: string;
    }>(),
  },
  (t) => ({
    platformPostedIdx: index("jobs_platform_posted_idx").on(t.platform, t.postedAt),
    categoryIdx: index("jobs_category_idx").on(t.categoryId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amountRub: integer("amount_rub").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    ukassaId: text("ukassa_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    paidAt: timestamp("paid_at"),
    meta: jsonb("meta").$type<{
      receiptUrl?: string;
      promoCode?: string;
    }>(),
  },
  (t) => ({
    userIdx: index("payments_user_idx").on(t.userId),
    statusIdx: index("payments_status_idx").on(t.status),
  }),
);

export const aiCosts = pgTable(
  "ai_costs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    provider: aiProvider("provider").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull(),
    tokensOut: integer("tokens_out").notNull(),
    costUsd: integer("cost_usd_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    providerCreatedIdx: index("ai_costs_provider_created_idx").on(t.provider, t.createdAt),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  payments: many(payments),
  aiCosts: many(aiCosts),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id] }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  category: one(categories, { fields: [jobs.categoryId], references: [categories.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

export const aiCostsRelations = relations(aiCosts, ({ one }) => ({
  user: one(users, { fields: [aiCosts.userId], references: [users.id] }),
}));
