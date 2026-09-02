/**
 * Seed the `with-clerk` demo database.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 *
 * Creates 3 users (one with role "admin") and 5 posts. The "admin" user's
 * email is the address you should sign up with in Clerk; then set
 * `publicMetadata.role = "admin"` on that Clerk user in the dashboard to
 * actually open the admin (`withClerk` checks the Clerk session, not this
 * row — the local `users.role` is shown in the admin table for clarity).
 *
 * The `clerkId`s are placeholders in Clerk's `user_...` format; real rows
 * would carry the id from `auth().userId`.
 */
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseUrl } from "../src/db/connection";
import * as schema from "../src/db/schema";

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });
  try {
    await db.execute(sql`TRUNCATE TABLE ${schema.posts}, ${schema.users} RESTART IDENTITY CASCADE`);

    const userRows = await db
      .insert(schema.users)
      .values([
        { clerkId: "user_2rG8kQxTAdMnSeeD01a2b3c4d5e", email: "admin@example.com", role: "admin" },
        { clerkId: "user_2rG8kQxTALiCeSeeD01a2b3c4d5", email: "alice@example.com", role: "member" },
        { clerkId: "user_2rG8kQxTBoBSeeD01a2b3c4d5e6", email: "bob@example.com", role: "member" },
      ])
      .returning({ id: schema.users.id });

    const adminId = userRows[0]?.id;
    const aliceId = userRows[1]?.id;
    const bobId = userRows[2]?.id;
    if (!adminId || !aliceId || !bobId) throw new Error("seed: user ids missing");

    await db.insert(schema.posts).values([
      { authorId: adminId, title: "Welcome to with-clerk", body: "Hello!", published: true },
      { authorId: aliceId, title: "First post", body: "Hi from Alice.", published: true },
      { authorId: aliceId, title: "Draft idea", body: "WIP", published: false },
      { authorId: bobId, title: "Hello world", body: "Bob's first.", published: true },
      { authorId: bobId, title: "Untitled", body: null, published: false },
    ]);

    console.log(JSON.stringify({ ok: true, users: userRows.length, posts: 5 }));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("seed failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  });
}
