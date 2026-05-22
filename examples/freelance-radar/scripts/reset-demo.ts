/**
 * Reset the public demo database back to a known-good seed state.
 *
 * Designed to run from cron on the host (Railway scheduled command, fly
 * machines, GitHub Actions cron, Coolify scheduled task, …):
 *
 *   DATABASE_URL=postgres://... pnpm exec tsx scripts/reset-demo.ts
 *
 * Idempotent: TRUNCATE … RESTART IDENTITY CASCADE before reseed, so the
 * resulting state matches the one shipped in `scripts/seed.ts`. Safe to
 * invoke as often as you like — recommended cadence is every 30–60 min.
 *
 * Exits non-zero on any failure so the cron platform can alert.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

const HELP = `Reset the FlowPanel public demo database.

Usage:
  DATABASE_URL=postgres://... pnpm exec tsx scripts/reset-demo.ts [--help]

What it does:
  1. TRUNCATEs every demo table (RESTART IDENTITY CASCADE).
  2. Re-inserts the seed rows from scripts/seed.ts.

Environment:
  DATABASE_URL   Required in production. Falls back to the local
                 docker-compose URL when unset.`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const connectionString =
  process.env.DATABASE_URL ?? "postgres://fp:fp@localhost:54329/freelance_radar";

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function reset() {
  console.log("⏳ resetting demo database…");

  await db.execute(
    sql`TRUNCATE TABLE ${schema.aiCosts}, ${schema.payments}, ${schema.jobs}, ${schema.categories}, ${schema.users} RESTART IDENTITY CASCADE`,
  );

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

  const catRows = await db
    .insert(schema.categories)
    .values([
      { slug: "web-dev", name: "Web Development" },
      { slug: "mobile", name: "Mobile" },
      { slug: "design", name: "Design" },
    ])
    .returning({ id: schema.categories.id });

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
  }

  console.log("✅ demo database reset");
}

reset()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("reset-demo failed:", err);
    await pool.end().catch(() => {});
    process.exit(1);
  });
