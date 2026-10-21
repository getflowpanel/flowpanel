import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./src/db/connection";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  tablesFilter: ["!_flowpanel_migrations", "!flowpanel_audit_log"],
  dbCredentials: {
    url: databaseUrl,
  },
});
