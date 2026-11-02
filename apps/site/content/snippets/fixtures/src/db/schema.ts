import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  pgView,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const planTier = pgEnum("plan_tier", ["free", "starter", "pro", "business"]);
export const accountStatus = pgEnum("account_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
]);
export const monitorStatus = pgEnum("monitor_status", ["active", "paused", "error"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "success", "failed"]);
export const invoiceStatus = pgEnum("invoice_status", ["open", "paid", "void", "refunded"]);
export const activitySurface = pgEnum("activity_surface", ["web", "tma"]);
export const orderStatus = pgEnum("order_status", ["pending", "paid", "shipped", "refunded"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull(),
  status: text("status").notNull().default("active"),
  tenantId: text("tenant_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  plan: planTier("plan").notNull().default("free"),
  status: accountStatus("status").notNull().default("trialing"),
  mrr: integer("mrr").notNull().default(0),
  churned: boolean("churned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
  deletedAt: timestamp("deleted_at"),
});

export const monitors = pgTable("monitors", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  name: text("name").notNull(),
  targetUrl: text("target_url").notNull(),
  status: monitorStatus("status").notNull().default("active"),
  errorRate: doublePrecision("error_rate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastRunAt: timestamp("last_run_at"),
});

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitor_id")
    .notNull()
    .references(() => monitors.id),
  status: runStatus("status").notNull().default("queued"),
  pagesCrawled: integer("pages_crawled").notNull().default(0),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  error: text("error"),
});

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  monitorId: integer("monitor_id")
    .notNull()
    .references(() => monitors.id),
  runId: integer("run_id").references(() => runs.id),
  site: text("site").notNull(),
  title: text("title").notNull(),
  priceCents: integer("price_cents").notNull(),
  rating: doublePrecision("rating"),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  amountCents: integer("amount_cents").notNull(),
  status: invoiceStatus("status").notNull().default("open"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  tenantId: text("tenant_id").notNull(),
  number: text("number").notNull(),
  customerEmail: text("customer_email").notNull(),
  userId: text("user_id").references(() => users.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  status: orderStatus("status").notNull().default("pending"),
  total: doublePrecision("total").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  sku: text("sku").notNull(),
  quantity: integer("quantity").notNull(),
  priceCents: integer("price_cents").notNull(),
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("freelancer"),
  plan: planTier("plan").notNull().default("free"),
  lifecycle: text("lifecycle").notNull().default("new"),
  internal: boolean("internal").notNull().default(false),
  isTest: boolean("is_test").notNull().default(false),
  telegramLinked: boolean("telegram_linked").notNull().default(false),
  telegramLinkedAt: timestamp("telegram_linked_at"),
  daysSinceSeen: integer("days_since_seen"),
  firstSentAt: timestamp("first_sent_at"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminUserRow = pgView("admin_user_row", {
  id: text("id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  internal: boolean("internal").notNull(),
  createdAt: timestamp("created_at").notNull(),
}).existing();

export const userVisit = pgTable("user_visit", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  surface: activitySurface("surface").notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  touches: integer("touches").notNull().default(0),
});

export const freelancerProfile = pgTable("freelancer_profile", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  hourlyRate: integer("hourly_rate"),
  bio: text("bio"),
  resumeText: text("resume_text"),
});

export const response = pgTable("response", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payment = pgTable("payment", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const telegramMessageLog = pgTable("telegram_message_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notificationLog = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => user.id),
  failedReason: text("failed_reason"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const scraperRun = pgTable("scraper_run", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  status: runStatus("status").notNull().default("queued"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
});

export const aiRun = pgTable("ai_run", {
  id: serial("id").primaryKey(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  openJobs: integer("open_jobs").notNull().default(0),
});

export const job = pgTable("job", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customerEvents = pgTable("customer_events", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id),
  kind: text("kind").notNull(),
  at: timestamp("at").notNull().defaultNow(),
});

export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  company: text("company"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
