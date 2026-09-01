import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../db/schema";
import { generateDemoData } from "../data/generate";
import { SeedMappingError, seedRows } from "./seed-rows";

export const SEED_VERSION = 1;

type Db = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export function buildSandboxMetadataUpdate(now: Date, { markReset }: { markReset: boolean }) {
  return {
    seedVersion: SEED_VERSION,
    lastSeenAt: now,
    lastResetAt: markReset ? now : null,
    inactivityExpiresAt: new Date(now.getTime() + 60 * 60_000),
  };
}

function idMap(rows: { id: number; seedKey: number | null }[], relation: string) {
  const result = new Map<number, number>();
  for (const row of rows) {
    if (row.seedKey === null) {
      throw new SeedMappingError(`Insert for ${relation} returned a null seed key`);
    }
    result.set(row.seedKey, row.id);
  }
  return result;
}

async function clearSandboxRows(tx: Transaction, sandboxId: string) {
  await tx.delete(schema.matches).where(eq(schema.matches.sandboxId, sandboxId));
  await tx.delete(schema.aiUsage).where(eq(schema.aiUsage.sandboxId, sandboxId));
  await tx.delete(schema.invoices).where(eq(schema.invoices.sandboxId, sandboxId));
  await tx.delete(schema.listings).where(eq(schema.listings.sandboxId, sandboxId));
  await tx.delete(schema.products).where(eq(schema.products.sandboxId, sandboxId));
  await tx.delete(schema.runs).where(eq(schema.runs.sandboxId, sandboxId));
  await tx.delete(schema.monitors).where(eq(schema.monitors.sandboxId, sandboxId));
  await tx.delete(schema.customers).where(eq(schema.customers.sandboxId, sandboxId));
}

/** Seed inside a caller-owned transaction so first-time provisioning remains atomic. */
export async function seedSandboxInTransaction(
  tx: Transaction,
  sandboxId: string,
  now: Date,
  { force = false, markReset = false }: { force?: boolean; markReset?: boolean } = {},
): Promise<boolean> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${sandboxId}, 0))`);
  await tx
    .insert(schema.demoSandboxes)
    .values({
      id: sandboxId,
      seedVersion: 0,
      createdAt: now,
      lastSeenAt: now,
      inactivityExpiresAt: new Date(now.getTime() + 60 * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
      fingerprintHash: null,
    })
    .onConflictDoNothing({ target: schema.demoSandboxes.id });

  const [current] = await tx
    .select({ seedVersion: schema.demoSandboxes.seedVersion })
    .from(schema.demoSandboxes)
    .where(eq(schema.demoSandboxes.id, sandboxId))
    .limit(1);
  if (!force && current?.seedVersion === SEED_VERSION) return false;

  await clearSandboxRows(tx, sandboxId);
  const data = generateDemoData({ now });

  const insertedCustomers = await tx
    .insert(schema.customers)
    .values(seedRows.customers(data, sandboxId))
    .returning({ id: schema.customers.id, seedKey: schema.customers.seedKey });
  const customerIds = idMap(insertedCustomers, "customer");

  const insertedMonitors = await tx
    .insert(schema.monitors)
    .values(seedRows.monitors(data, sandboxId, customerIds))
    .returning({ id: schema.monitors.id, seedKey: schema.monitors.seedKey });
  const monitorIds = idMap(insertedMonitors, "monitor");

  const insertedRuns = await tx
    .insert(schema.runs)
    .values(seedRows.runs(data, sandboxId, monitorIds))
    .returning({ id: schema.runs.id, seedKey: schema.runs.seedKey });
  const runIds = idMap(insertedRuns, "run");

  const insertedProducts = await tx
    .insert(schema.products)
    .values(seedRows.products(data, sandboxId, customerIds))
    .returning({ id: schema.products.id, seedKey: schema.products.seedKey });
  const productIds = idMap(insertedProducts, "product");

  const insertedListings = await tx
    .insert(schema.listings)
    .values(seedRows.listings(data, sandboxId, { monitors: monitorIds, runs: runIds }))
    .returning({ id: schema.listings.id, seedKey: schema.listings.seedKey });
  const listingIds = idMap(insertedListings, "listing");

  await tx
    .insert(schema.matches)
    .values(seedRows.matches(data, sandboxId, { listings: listingIds, products: productIds }));
  await tx.insert(schema.invoices).values(seedRows.invoices(data, sandboxId, customerIds));
  await tx
    .insert(schema.aiUsage)
    .values(seedRows.aiUsage(data, sandboxId, { customers: customerIds, runs: runIds }));

  await tx
    .update(schema.demoSandboxes)
    .set(buildSandboxMetadataUpdate(now, { markReset }))
    .where(eq(schema.demoSandboxes.id, sandboxId));
  return true;
}

export async function seedSandbox(db: Db, sandboxId: string, now: Date): Promise<boolean> {
  return db.transaction((tx) => seedSandboxInTransaction(tx, sandboxId, now));
}

export async function resetSandboxData(db: Db, sandboxId: string, now: Date): Promise<void> {
  await db.transaction((tx) =>
    seedSandboxInTransaction(tx, sandboxId, now, { force: true, markReset: true }),
  );
}
