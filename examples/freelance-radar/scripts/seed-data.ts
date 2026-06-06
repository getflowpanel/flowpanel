/**
 * Shared seed logic for the freelance-radar demo.
 *
 * Both `scripts/seed.ts` (local dev) and `scripts/reset-demo.ts` (public
 * demo cron) import `seedDatabase` so the two never drift. The function is
 * idempotent: it TRUNCATEs every table (RESTART IDENTITY CASCADE) before
 * re-inserting, so it is safe to call on every boot / cron tick.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";

type Db = NodePgDatabase<typeof schema>;

const day = (n: number) => new Date(Date.now() - n * 86400_000);

/** Wipe + reseed the demo database. Idempotent and re-runnable. */
export async function seedDatabase(db: Db): Promise<void> {
  // Wipe in dependency order so seed is re-runnable.
  await db.execute(
    sql`TRUNCATE TABLE ${schema.aiCosts}, ${schema.payments}, ${schema.jobs}, ${schema.categories}, ${schema.users} RESTART IDENTITY CASCADE`,
  );

  // Users — spread across the last week so the Signups chart has a real curve.
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
  const userIds = userRows.map((r) => r.id);
  const uid = (i: number): number => {
    const id = userIds[i];
    if (id === undefined) throw new Error(`seed: missing user #${i}`);
    return id;
  };

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

  // Payments — spread across users so the table looks realistic (amountRub in kopecks).
  await db.insert(schema.payments).values([
    { userId: uid(0), amountRub: 199000, status: "succeeded", paidAt: new Date() },
    {
      userId: uid(2),
      amountRub: 499000,
      status: "succeeded",
      paidAt: new Date(Date.now() - 30 * 86400_000),
    },
    { userId: uid(4), amountRub: 199000, status: "pending" },
    {
      userId: uid(3),
      amountRub: 199000,
      status: "refunded",
      paidAt: new Date(Date.now() - 5 * 86400_000),
    },
  ]);

  // AI costs — spread across users and providers (costUsd in cents).
  await db.insert(schema.aiCosts).values([
    {
      userId: uid(0),
      provider: "openai",
      model: "gpt-4o",
      tokensIn: 1200,
      tokensOut: 800,
      costUsd: 340,
    },
    {
      userId: uid(2),
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      tokensIn: 800,
      tokensOut: 400,
      costUsd: 280,
    },
    {
      userId: uid(4),
      provider: "gemini",
      model: "gemini-1.5-pro",
      tokensIn: 600,
      tokensOut: 200,
      costUsd: 120,
    },
    {
      userId: uid(1),
      provider: "openai",
      model: "gpt-4o-mini",
      tokensIn: 2400,
      tokensOut: 1600,
      costUsd: 90,
    },
    {
      userId: uid(2),
      provider: "anthropic",
      model: "claude-3-5-haiku",
      tokensIn: 1500,
      tokensOut: 900,
      costUsd: 60,
    },
  ]);
}
