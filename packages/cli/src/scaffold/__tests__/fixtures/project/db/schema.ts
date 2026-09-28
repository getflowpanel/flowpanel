import {
  boolean,
  date,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

export const activitySurface = pgEnum("activity_surface", ["web", "tma"]);

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    email: text("email"),
    name: text("name").notNull(),
    internal: boolean("internal").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("user_workspace_id_id_key").on(t.workspaceId, t.id)],
);

export const userVisit = pgTable("user_visit", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  surface: activitySurface("surface").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  day: date("day"),
  firstPath: varchar("first_path", { length: 160 }),
  meta: jsonb("meta"),
  description: text("description"),
  touches: integer("touches").notNull().default(1),
});

export const invoice = pgTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.workspaceId, t.userId], foreignColumns: [user.workspaceId, user.id] }),
  ],
);
