import { dashboard, defineAdmin, metric, resource, table } from "@flowpanel/kit";
import { withClerk } from "@flowpanel/kit/auth";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
  }
  interface FlowpanelResources {
    users: typeof schema.users.$inferSelect;
    posts: typeof schema.posts.$inferSelect;
  }
}

/**
 * The showcase — `withClerk({ requireRole: "admin" })` is the only auth wiring
 * needed. `clerkMiddleware()` in `middleware.ts` populates `auth()`, and
 * `withClerk` reads `sessionClaims.publicMetadata.role` by default.
 *
 * Beyond auth, this config also exercises every Phase-0 feature so the
 * dogfood CI workflow (`.github/workflows/dogfood.yml`) verifies them on
 * every PR:
 *
 * - **Row actions**: "Promote to admin" / "Reset to member" on users.
 * - **Bulk actions**: "Publish selected" / "Unpublish selected" on posts.
 * - **FK columns**: `posts.authorId` rendered as `<Link>` to the author's
 *   user drawer via `reference: { resource: "users", labelField: "email" }`.
 * - **Detail page tabs**: users show "Profile" + "Recent posts" (related
 *   resource tab) side-by-side.
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
      actions: [
        {
          key: "promote",
          label: "Promote to admin",
          confirm: {
            title: "Promote this user to admin?",
            description: "The user will be able to access the admin panel.",
          },
          hidden: async (row) => row.role === "admin",
          run: async (row, _input, { db }) => {
            await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, row.id));
            return { ok: true, message: `Promoted ${row.email}`, refresh: true };
          },
        },
        {
          key: "demote",
          label: "Reset to member",
          variant: "destructive",
          confirm: {
            title: "Reset this user's role?",
            description: "They lose admin access immediately.",
          },
          hidden: async (row) => row.role !== "admin",
          run: async (row, _input, { db }) => {
            await db
              .update(schema.users)
              .set({ role: "member" })
              .where(eq(schema.users.id, row.id));
            return { ok: true, message: `${row.email} is now a member`, refresh: true };
          },
        },
      ],
      detail: {
        tabs: [
          {
            key: "profile",
            label: "Profile",
            fields: ["email", "role", "clerkId", "createdAt"],
          },
          {
            key: "posts",
            label: "Posts",
            resource: "posts",
            filter: (row) => ({ authorId: row.id }),
          },
        ],
      },
    }),
    resource(schema.posts, {
      label: "Posts",
      columns: [
        "title",
        { field: "authorId", reference: { resource: "users", labelField: "email" } },
        "published",
        "createdAt",
      ],
      search: ["title", "body"],
      filters: [{ field: "published", type: "boolean", label: "Published" }],
      defaultSort: { field: "createdAt", dir: "desc" },
      bulkActions: [
        {
          key: "publish",
          label: "Publish selected",
          confirm: {
            title: "Publish selected posts?",
            description: "Sets `published = true`.",
          },
          run: async (ids, _input, { db }) => {
            const numericIds = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
            await db
              .update(schema.posts)
              .set({ published: true })
              .where(inArray(schema.posts.id, numericIds));
            return { ok: true, message: `Published ${ids.length}`, refresh: true };
          },
        },
        {
          key: "unpublish",
          label: "Unpublish selected",
          variant: "destructive",
          confirm: {
            title: "Unpublish selected posts?",
            description: "Sets `published = false`. Idempotent.",
          },
          run: async (ids, _input, { db }) => {
            const numericIds = ids.map((id) => Number(id)).filter((n) => Number.isFinite(n));
            await db
              .update(schema.posts)
              .set({ published: false })
              .where(inArray(schema.posts.id, numericIds));
            return { ok: true, message: `Unpublished ${ids.length}`, refresh: true };
          },
        },
      ],
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
