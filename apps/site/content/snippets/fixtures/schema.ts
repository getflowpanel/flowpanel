import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull(),
});
