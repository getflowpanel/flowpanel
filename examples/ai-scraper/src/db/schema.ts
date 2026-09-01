/**
 * ScrapeAI: customers upload a catalog (`products`), scheduled `monitors` crawl
 * marketplaces into `listings`, and the AI links the two as scored `matches`.
 */

import { relations } from "drizzle-orm";
import {
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
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

/** Browser-scoped demo tenancy and lifecycle metadata. */
export const demoSandboxes = pgTable(
  "demo_sandboxes",
  {
    id: text("id").primaryKey(),
    seedVersion: integer("seed_version").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    inactivityExpiresAt: timestamp("inactivity_expires_at").notNull(),
    absoluteExpiresAt: timestamp("absolute_expires_at").notNull(),
    lastResetAt: timestamp("last_reset_at"),
    fingerprintHash: text("fingerprint_hash"),
  },
  (t) => ({
    inactivityExpiryIdx: index("demo_sandboxes_inactivity_expiry_idx").on(t.inactivityExpiresAt),
    absoluteExpiryIdx: index("demo_sandboxes_absolute_expiry_idx").on(t.absoluteExpiresAt),
    fingerprintCreatedIdx: index("demo_sandboxes_fingerprint_created_idx").on(
      t.fingerprintHash,
      t.createdAt,
    ),
  }),
);

/** Singleton row coordinating cleanup across app instances. */
export const demoMaintenance = pgTable("demo_maintenance", {
  id: integer("id").primaryKey(),
  lastCleanupAt: timestamp("last_cleanup_at").notNull(),
});

/** A factory is required because Drizzle columns may belong to only one table. */
const sandboxColumns = () => ({
  sandboxId: text("sandbox_id")
    .notNull()
    .references(() => demoSandboxes.id, { onDelete: "cascade" }),
  seedKey: integer("seed_key"),
});

/** Customers of the SaaS. */
export const customers = pgTable(
  "customers",
  {
    ...sandboxColumns(),
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
    ownershipKey: unique("customers_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("customers_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    emailIdx: uniqueIndex("customers_sandbox_email_idx").on(t.sandboxId, t.email),
  }),
);

/** A scraper a customer configured against some target site. */
export const monitors = pgTable(
  "monitors",
  {
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    schedule: scheduleKind("schedule").notNull().default("daily"),
    status: monitorStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at"),
  },
  (t) => ({
    ownershipKey: unique("monitors_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("monitors_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    customerFk: foreignKey({
      columns: [t.sandboxId, t.customerId],
      foreignColumns: [customers.sandboxId, customers.id],
    }),
    customerIdx: index("monitors_sandbox_customer_idx").on(t.sandboxId, t.customerId),
    statusIdx: index("monitors_sandbox_status_idx").on(t.sandboxId, t.status),
  }),
);

/** A single execution of a scraper. */
export const runs = pgTable(
  "runs",
  {
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id").notNull(),
    status: runStatus("status").notNull().default("queued"),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    itemsExtracted: integer("items_extracted").notNull().default(0),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    error: text("error"),
  },
  (t) => ({
    ownershipKey: unique("runs_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("runs_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    monitorFk: foreignKey({
      columns: [t.sandboxId, t.monitorId],
      foreignColumns: [monitors.sandboxId, monitors.id],
    }).onDelete("cascade"),
    monitorIdx: index("runs_sandbox_monitor_idx").on(t.sandboxId, t.monitorId),
    statusStartedIdx: index("runs_sandbox_status_started_idx").on(
      t.sandboxId,
      t.status,
      t.startedAt,
    ),
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
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id").notNull(),
    runId: integer("run_id"),
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
    ownershipKey: unique("listings_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("listings_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    monitorFk: foreignKey({
      columns: [t.sandboxId, t.monitorId],
      foreignColumns: [monitors.sandboxId, monitors.id],
    }).onDelete("cascade"),
    runFk: foreignKey({
      columns: [t.sandboxId, t.runId],
      foreignColumns: [runs.sandboxId, runs.id],
    }),
    monitorIdx: index("listings_sandbox_monitor_idx").on(t.sandboxId, t.monitorId),
    runIdx: index("listings_sandbox_run_idx").on(t.sandboxId, t.runId),
    siteIdx: index("listings_sandbox_site_idx").on(t.sandboxId, t.site),
    categoryIdx: index("listings_sandbox_category_idx").on(t.sandboxId, t.category),
  }),
);

/** The customer's own catalog — the SKUs they sell and want matched. */
export const products = pgTable(
  "products",
  {
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    brand: text("brand"),
    category: text("category").notNull(),
    ourPriceCents: integer("our_price_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    ownershipKey: unique("products_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("products_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    customerFk: foreignKey({
      columns: [t.sandboxId, t.customerId],
      foreignColumns: [customers.sandboxId, customers.id],
    }),
    customerIdx: index("products_sandbox_customer_idx").on(t.sandboxId, t.customerId),
    skuIdx: uniqueIndex("products_sandbox_customer_sku_idx").on(t.sandboxId, t.customerId, t.sku),
    categoryIdx: index("products_sandbox_category_idx").on(t.sandboxId, t.category),
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
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    listingId: integer("listing_id").notNull(),
    productId: integer("product_id").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    status: matchStatus("status").notNull().default("needs_review"),
    model: text("model").notNull(),
    matchedAt: timestamp("matched_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by"),
  },
  (t) => ({
    ownershipKey: unique("matches_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("matches_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    listingFk: foreignKey({
      columns: [t.sandboxId, t.listingId],
      foreignColumns: [listings.sandboxId, listings.id],
    }).onDelete("cascade"),
    productFk: foreignKey({
      columns: [t.sandboxId, t.productId],
      foreignColumns: [products.sandboxId, products.id],
    }).onDelete("cascade"),
    statusConfidenceIdx: index("matches_sandbox_status_confidence_idx").on(
      t.sandboxId,
      t.status,
      t.confidence,
    ),
    listingIdx: index("matches_sandbox_listing_idx").on(t.sandboxId, t.listingId),
    productIdx: index("matches_sandbox_product_idx").on(t.sandboxId, t.productId),
  }),
);

/** Subscription invoices, billed in USD cents. */
export const invoices = pgTable(
  "invoices",
  {
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: invoiceStatus("status").notNull().default("open"),
    stripeId: text("stripe_id"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    ownershipKey: unique("invoices_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("invoices_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    customerFk: foreignKey({
      columns: [t.sandboxId, t.customerId],
      foreignColumns: [customers.sandboxId, customers.id],
    }),
    customerIdx: index("invoices_sandbox_customer_idx").on(t.sandboxId, t.customerId),
    statusIdx: index("invoices_sandbox_status_idx").on(t.sandboxId, t.status),
  }),
);

/** Per-run LLM usage, metered for billing (cost in USD cents). */
export const aiUsage = pgTable(
  "ai_usage",
  {
    ...sandboxColumns(),
    id: serial("id").primaryKey(),
    customerId: integer("customer_id"),
    runId: integer("run_id"),
    provider: aiProvider("provider").notNull(),
    model: text("model").notNull(),
    task: aiTask("task").notNull().default("extract"),
    tokensIn: integer("tokens_in").notNull(),
    tokensOut: integer("tokens_out").notNull(),
    costCents: integer("cost_cents").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    ownershipKey: unique("ai_usage_sandbox_id_id_key").on(t.sandboxId, t.id),
    seedKeyIdx: uniqueIndex("ai_usage_sandbox_seed_key_idx").on(t.sandboxId, t.seedKey),
    customerFk: foreignKey({
      columns: [t.sandboxId, t.customerId],
      foreignColumns: [customers.sandboxId, customers.id],
    }),
    runFk: foreignKey({
      columns: [t.sandboxId, t.runId],
      foreignColumns: [runs.sandboxId, runs.id],
    }).onDelete("cascade"),
    providerCreatedIdx: index("ai_usage_sandbox_provider_created_idx").on(
      t.sandboxId,
      t.provider,
      t.createdAt,
    ),
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
    fields: [monitors.sandboxId, monitors.customerId],
    references: [customers.sandboxId, customers.id],
  }),
  runs: many(runs),
  listings: many(listings),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  monitor: one(monitors, {
    fields: [runs.sandboxId, runs.monitorId],
    references: [monitors.sandboxId, monitors.id],
  }),
  listings: many(listings),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  monitor: one(monitors, {
    fields: [listings.sandboxId, listings.monitorId],
    references: [monitors.sandboxId, monitors.id],
  }),
  run: one(runs, {
    fields: [listings.sandboxId, listings.runId],
    references: [runs.sandboxId, runs.id],
  }),
  matches: many(matches),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  customer: one(customers, {
    fields: [products.sandboxId, products.customerId],
    references: [customers.sandboxId, customers.id],
  }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  listing: one(listings, {
    fields: [matches.sandboxId, matches.listingId],
    references: [listings.sandboxId, listings.id],
  }),
  product: one(products, {
    fields: [matches.sandboxId, matches.productId],
    references: [products.sandboxId, products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  customer: one(customers, {
    fields: [invoices.sandboxId, invoices.customerId],
    references: [customers.sandboxId, customers.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  customer: one(customers, {
    fields: [aiUsage.sandboxId, aiUsage.customerId],
    references: [customers.sandboxId, customers.id],
  }),
  run: one(runs, {
    fields: [aiUsage.sandboxId, aiUsage.runId],
    references: [runs.sandboxId, runs.id],
  }),
}));
