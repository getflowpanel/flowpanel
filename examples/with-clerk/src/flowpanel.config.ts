import { sql } from "drizzle-orm";
import { dashboard, defineAdmin, metric, resource, table } from "flowpanel";
import { withClerk } from "flowpanel/auth";
import { drizzleAdapter } from "flowpanel/drizzle";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

/**
 * The showcase — `withClerk({ requireRole: "admin" })` is the only auth wiring
 * needed. `clerkMiddleware()` in `middleware.ts` populates `auth()`, and
 * `withClerk` reads `sessionClaims.publicMetadata.role` by default.
 *
 * Set `publicMetadata.role = "admin"` on a Clerk user in the Clerk dashboard
 * to grant access.
 */
export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: withClerk({ requireRole: "admin" }),
  resources: [
    resource(schema.users, {
      label: "Users",
      columns: ["email", "role", "createdAt"],
      search: ["email", "clerkId"],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
    resource(schema.posts, {
      label: "Posts",
      columns: ["title", "authorId", "published", "createdAt"],
      search: ["title", "body"],
      filters: [{ field: "published", type: "boolean", label: "Published" }],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
  ],
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      sections: [
        {
          label: "Totals",
          columns: 2,
          widgets: [
            metric("Users", async ({ db }) => {
              const rows = await db.select({ c: sql<number>`count(*)::int` }).from(schema.users);
              return Number(rows[0]?.c ?? 0);
            }),
            metric("Posts", async ({ db }) => {
              const rows = await db.select({ c: sql<number>`count(*)::int` }).from(schema.posts);
              return Number(rows[0]?.c ?? 0);
            }),
          ],
        },
        {
          label: "Recent users",
          columns: 1,
          widgets: [table({ resource: "users", limit: 10 })],
        },
      ],
    }),
  ],
});
