import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { resources } from "./resources";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: { session: async () => null, role: () => "admin" },
  resources,
});
