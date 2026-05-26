/**
 * Seed the `with-clerk` demo database.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 *
 * Creates 3 users (one with role "admin") and 5 posts. The "admin" user's
 * email is the address you should sign up with in Clerk; then set
 * `publicMetadata.role = "admin"` on that Clerk user in the dashboard to
 * actually open the admin (`withClerk` checks the Clerk session, not this
 * row — the local `users.role` is shown in the admin table for clarity).
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

const db = drizzle(
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54330/with_clerk",
  }),
  { schema },
);

async function seed() {
  console.log("seeding…");

  await db.execute(sql`TRUNCATE TABLE ${schema.posts}, ${schema.users} RESTART IDENTITY CASCADE`);

  const userRows = await db
    .insert(schema.users)
    .values([
      { email: "admin@example.com", role: "admin" },
      { email: "alice@example.com", role: "member" },
      { email: "bob@example.com", role: "member" },
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

  console.log("seeded");
  process.exit(0);
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
