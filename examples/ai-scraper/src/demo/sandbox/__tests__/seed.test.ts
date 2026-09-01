import { describe, expect, it } from "vitest";
import { generateDemoData } from "../../data/generate";
import { buildSandboxMetadataUpdate } from "../seed";
import { SeedMappingError, seedRows } from "../seed-rows";

const now = new Date("2026-08-30T00:00:00.000Z");

function offsetMap(rows: { id: number }[], offset: number) {
  return new Map(rows.map((row) => [row.id, row.id + offset]));
}

describe("sandbox seed remapping", () => {
  it("starts reset cooldown only after an explicit reset", () => {
    expect(buildSandboxMetadataUpdate(now, { markReset: false })).not.toHaveProperty("lastResetAt");
    expect(buildSandboxMetadataUpdate(now, { markReset: true })).toMatchObject({
      lastResetAt: now,
    });
  });

  it("preserves every generator id as seedKey and maps every relation to database ids", () => {
    const data = generateDemoData({ now });
    const ids = {
      customers: offsetMap(data.customers, 1000),
      monitors: offsetMap(data.monitors, 2000),
      runs: offsetMap(data.runs, 3000),
      products: offsetMap(data.products, 4000),
      listings: offsetMap(data.listings, 5000),
    };

    const plan = {
      customers: seedRows.customers(data, "sandbox-a"),
      monitors: seedRows.monitors(data, "sandbox-a", ids.customers),
      runs: seedRows.runs(data, "sandbox-a", ids.monitors),
      products: seedRows.products(data, "sandbox-a", ids.customers),
      listings: seedRows.listings(data, "sandbox-a", ids),
      matches: seedRows.matches(data, "sandbox-a", ids),
      invoices: seedRows.invoices(data, "sandbox-a", ids.customers),
      aiUsage: seedRows.aiUsage(data, "sandbox-a", ids),
    };

    expect(plan.customers[0]).toMatchObject({ sandboxId: "sandbox-a", seedKey: 1 });
    expect(plan.monitors[0]).toMatchObject({
      sandboxId: "sandbox-a",
      seedKey: 1,
      customerId: 1001,
    });
    expect(plan.runs[0]).toMatchObject({ monitorId: 2001 });
    expect(plan.products[0]).toMatchObject({ customerId: 1001 });
    expect(plan.listings[0]).toMatchObject({ monitorId: 2001 });
    expect(plan.matches[0]).toMatchObject({ listingId: 5001, productId: 4001 });
    expect(plan.invoices[0]?.customerId).toBeGreaterThan(1000);
    expect(plan.aiUsage[0]?.runId).toBeGreaterThan(3000);

    for (const rows of Object.values(plan)) {
      expect(rows.every((row) => typeof row.seedKey === "number")).toBe(true);
      expect(rows.every((row) => !("id" in row))).toBe(true);
    }
  });

  it("fails closed when a generated relation has no inserted parent mapping", () => {
    const data = generateDemoData({ now });
    const ids = {
      customers: new Map<number, number>(),
      monitors: offsetMap(data.monitors, 2000),
      runs: offsetMap(data.runs, 3000),
      products: offsetMap(data.products, 4000),
      listings: offsetMap(data.listings, 5000),
    };

    expect(() => seedRows.monitors(data, "sandbox-a", ids.customers)).toThrow(SeedMappingError);
  });
});
