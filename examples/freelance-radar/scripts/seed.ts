/**
 * Seed the demo database with realistic freelance-radar data.
 * Run: `pnpm db:seed` (after `pnpm docker:up && pnpm db:push`).
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

const db = drizzle(
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/freelance_radar",
  }),
  { schema },
);

async function seed() {
  console.log("⏳ seeding…");

  // Wipe in dependency order so seed is re-runnable.
  await db.execute(
    sql`TRUNCATE TABLE ${schema.aiCosts}, ${schema.payments}, ${schema.jobs}, ${schema.categories}, ${schema.users} RESTART IDENTITY CASCADE`,
  );

  // Users — spread across the last week so the Signups chart has a real curve.
  const day = (n: number) => new Date(Date.now() - n * 86400_000);
  const userRows = await db
    .insert(schema.users)
    .values([
      { email: "alice@example.com", plan: "pro", status: "active", createdAt: day(6) },
      { email: "bob@example.com", plan: "free", status: "trialing", createdAt: day(5) },
      { email: "carol@example.com", plan: "team", status: "active", createdAt: day(3) },
      { email: "dan@example.com", plan: "free", status: "canceled", createdAt: day(2) },
      { email: "erin@example.com", plan: "pro", status: "active", createdAt: day(1) },
      { email: "frank@example.com", plan: "free", status: "trialing", createdAt: day(0) },
    ])
    .returning({ id: schema.users.id });

  // Categories
  const catRows = await db
    .insert(schema.categories)
    .values([
      { slug: "web-dev", name: "Web Development" },
      { slug: "mobile", name: "Mobile" },
      { slug: "design", name: "Design" },
    ])
    .returning({ id: schema.categories.id });

  // Jobs
  await db.insert(schema.jobs).values([
    {
      title: "React admin panel for SaaS",
      platform: "upwork",
      categoryId: catRows[0]?.id,
      priceUsd: 4500,
      url: "https://example.com/1",
      postedAt: new Date(Date.now() - 3600_000),
    },
    {
      title: "iOS app UI polish",
      platform: "fl_ru",
      categoryId: catRows[1]?.id,
      priceUsd: 2200,
      url: "https://example.com/2",
      postedAt: new Date(Date.now() - 7200_000),
    },
    {
      title: "Brand refresh + landing design",
      platform: "kwork",
      categoryId: catRows[2]?.id,
      priceUsd: 3000,
      url: "https://example.com/3",
      postedAt: new Date(Date.now() - 86400_000),
    },
  ]);

  // Payments
  const userId = userRows[0]?.id;
  if (userId) {
    await db.insert(schema.payments).values([
      { userId, amountRub: 199000, status: "succeeded", paidAt: new Date() },
      {
        userId,
        amountRub: 199000,
        status: "succeeded",
        paidAt: new Date(Date.now() - 30 * 86400_000),
      },
      { userId, amountRub: 199000, status: "pending" },
    ]);
  }

  // AI costs
  await db.insert(schema.aiCosts).values([
    { userId, provider: "openai", model: "gpt-4o", tokensIn: 1200, tokensOut: 800, costUsd: 340 },
    {
      userId,
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      tokensIn: 800,
      tokensOut: 400,
      costUsd: 280,
    },
    {
      userId,
      provider: "gemini",
      model: "gemini-1.5-pro",
      tokensIn: 600,
      tokensOut: 200,
      costUsd: 120,
    },
  ]);

  console.log("✅ seeded");
  process.exit(0);
}

seed().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
