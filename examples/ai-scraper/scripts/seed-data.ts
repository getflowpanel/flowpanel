/**
 * Reset the demo to one deterministic, internally consistent product story.
 * Scenario construction lives in `src/demo/data`; this file only persists it.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { generateDemoData } from "../src/demo/data/generate";

type Db = NodePgDatabase<typeof schema>;

const withoutId = <Row extends { id: number }>({ id: _id, ...row }: Row) => row;

export async function seedDatabase(db: Db): Promise<void> {
  const data = generateDemoData({ now: new Date() });

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE TABLE
        ${schema.matches},
        ${schema.aiUsage},
        ${schema.invoices},
        ${schema.listings},
        ${schema.products},
        ${schema.runs},
        ${schema.monitors},
        ${schema.customers}
      RESTART IDENTITY CASCADE
    `);

    await tx.insert(schema.customers).values(data.customers.map(withoutId));
    await tx.insert(schema.monitors).values(data.monitors.map(withoutId));
    await tx.insert(schema.runs).values(data.runs.map(withoutId));
    await tx.insert(schema.products).values(data.products.map(withoutId));
    await tx.insert(schema.listings).values(data.listings.map(withoutId));
    await tx.insert(schema.matches).values(data.matches.map(withoutId));
    await tx.insert(schema.invoices).values(data.invoices.map(withoutId));
    await tx.insert(schema.aiUsage).values(data.aiUsage.map(withoutId));
  });
}
