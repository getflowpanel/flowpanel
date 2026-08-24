/**
 * ScrapeAI: customers upload a catalog (`products`), scheduled `scrapers` crawl
 * marketplaces into `listings`, and the AI links the two as scored `matches`.
 */

import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const planTier = pgEnum("plan_tier", ["free", "starter", "pro", "business"]);
export const accountStatus = pgEnum("account_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);
export const monitorStatus = pgEnum("monitor_status", ["active", "paused", "error"]);
export const scheduleKind = pgEnum("schedule_kind", ["manual", "hourly", "daily", "weekly"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "success", "failed"]);
export const invoiceStatus = pgEnum("invoice_status", ["open", "paid", "void", "refunded"]);
export const aiProvider = pgEnum("ai_provider", ["openai", "anthropic", "google"]);
export const stockStatus = pgEnum("stock_status", ["in_stock", "low_stock", "out_of_stock"]);
export const matchStatus = pgEnum("match_status", ["confirmed", "needs_review", "rejected"]);
export const aiTask = pgEnum("ai_task", ["match", "extract"]);

/** Customers of the SaaS. */
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    company: text("company"),
    plan: planTier("plan").notNull().default("free"),
    status: accountStatus("status").notNull().default("trialing"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    emailIdx: uniqueIndex("customers_email_idx").on(t.email),
  }),
);

/** A scraper a customer configured against some target site. */
export const monitors = pgTable(
  "monitors",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    schedule: scheduleKind("schedule").notNull().default("daily"),
    status: monitorStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at"),
  },
  (t) => ({
    customerIdx: index("monitors_customer_idx").on(t.customerId),
    statusIdx: index("monitors_status_idx").on(t.status),
  }),
);

/** A single execution of a scraper. */
export const runs = pgTable(
  "runs",
  {
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id),
    status: runStatus("status").notNull().default("queued"),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    itemsExtracted: integer("items_extracted").notNull().default(0),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    error: text("error"),
  },
  (t) => ({
    monitorIdx: index("runs_monitor_idx").on(t.monitorId),
    statusStartedIdx: index("runs_status_started_idx").on(t.status, t.startedAt),
  }),
);

/**
 * A competitor offer found in the wild — the same kind of product the
 * customer sells, listed on some marketplace. `runId` is nullable so a
 * listing can outlive the run that first found it (re-confirmed later).
 * `priceCents` keeps money as an integer; `rating` is a float.
 */
export const listings = pgTable(
  "listings",
  {
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id")
      .notNull()
      .references(() => monitors.id),
    runId: integer("run_id").references(() => runs.id),
    asin: text("asin").notNull(),
    site: text("site").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    category: text("category").notNull(),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    seller: text("seller"),
    rating: doublePrecision("rating"),
    reviews: integer("reviews").notNull().default(0),
    stock: stockStatus("stock").notNull().default("in_stock"),
    url: text("url"),
    scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  },
  (t) => ({
    monitorIdx: index("listings_monitor_idx").on(t.monitorId),
    runIdx: index("listings_run_idx").on(t.runId),
    siteIdx: index("listings_site_idx").on(t.site),
    categoryIdx: index("listings_category_idx").on(t.category),
  }),
);

/** The customer's own catalog — the SKUs they sell and want matched. */
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    category: text("category").notNull(),
    ourPriceCents: integer("our_price_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index("products_customer_idx").on(t.customerId),
    skuIdx: uniqueIndex("products_sku_idx").on(t.customerId, t.sku),
    categoryIdx: index("products_category_idx").on(t.category),
  }),
);

/**
 * The AI match: a listing linked to one of the customer's products, with a
 * confidence score. Low-confidence matches sit in `needs_review` until an
 * analyst confirms or rejects them — the human-in-the-loop core.
 */
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => listings.id),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    confidence: doublePrecision("confidence").notNull(),
    status: matchStatus("status").notNull().default("needs_review"),
    model: text("model").notNull(),
    matchedAt: timestamp("matched_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by"),
  },
  (t) => ({
    statusConfidenceIdx: index("matches_status_confidence_idx").on(t.status, t.confidence),
    listingIdx: index("matches_listing_idx").on(t.listingId),
    productIdx: index("matches_product_idx").on(t.productId),
  }),
);

/** Subscription invoices, billed in USD cents. */
export const invoices = pgTable(
  "invoices",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id),
    amountCents: integer("amount_cents").notNull(),
    status: invoiceStatus("status").notNull().default("open"),
    stripeId: text("stripe_id"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    customerIdx: index("invoices_customer_idx").on(t.customerId),
    statusIdx: index("invoices_status_idx").on(t.status),
  }),
);

/** Per-run LLM usage, metered for billing (cost in USD cents). */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id),
    runId: integer("run_id").references(() => runs.id),
    provider: aiProvider("provider").notNull(),
    model: text("model").notNull(),
    task: aiTask("task").notNull().default("extract"),
    tokensIn: integer("tokens_in").notNull(),
    tokensOut: integer("tokens_out").notNull(),
    costCents: integer("cost_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    providerCreatedIdx: index("ai_usage_provider_created_idx").on(t.provider, t.createdAt),
  }),
);

export const customersRelations = relations(customers, ({ many }) => ({
  monitors: many(monitors),
  invoices: many(invoices),
  aiUsage: many(aiUsage),
  products: many(products),
}));

export const monitorsRelations = relations(monitors, ({ one, many }) => ({
  customer: one(customers, {
    fields: [monitors.customerId],
    references: [customers.id],
  }),
  runs: many(runs),
  listings: many(listings),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  monitor: one(monitors, { fields: [runs.monitorId], references: [monitors.id] }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  monitor: one(monitors, {
    fields: [listings.monitorId],
    references: [monitors.id],
  }),
  run: one(runs, { fields: [listings.runId], references: [runs.id] }),
  matches: many(matches),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  customer: one(customers, {
    fields: [products.customerId],
    references: [customers.id],
  }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  listing: one(listings, { fields: [matches.listingId], references: [listings.id] }),
  product: one(products, { fields: [matches.productId], references: [products.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  customer: one(customers, {
    fields: [aiUsage.customerId],
    references: [customers.id],
  }),
  run: one(runs, { fields: [aiUsage.runId], references: [runs.id] }),
}));
