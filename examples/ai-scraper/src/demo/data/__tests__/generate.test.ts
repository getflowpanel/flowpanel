import { describe, expect, it } from "vitest";
import { generateDemoData } from "../generate";

const NOW = new Date("2026-08-24T12:00:00.000Z");
const data = generateDemoData({ now: NOW });

describe("canonical demo data", () => {
  it("has stable volume and a useful review backlog", () => {
    expect(data.customers).toHaveLength(48);
    expect(data.products.length).toBeGreaterThanOrEqual(48);
    expect(data.products.length).toBeLessThanOrEqual(60);
    expect(data.monitors.length).toBeGreaterThanOrEqual(32);
    expect(data.monitors.length).toBeLessThanOrEqual(40);
    expect(data.runs.length).toBeGreaterThanOrEqual(220);
    expect(data.listings.length).toBeGreaterThanOrEqual(220);
    expect(data.matches).toHaveLength(data.listings.length);
    const backlog = data.matches.filter((match) => match.status === "needs_review");
    expect(backlog.length).toBeGreaterThanOrEqual(24);
    expect(backlog.length).toBeLessThanOrEqual(30);
  });

  it("keeps the complete ownership graph within one customer", () => {
    const monitorById = new Map(data.monitors.map((row) => [row.id, row]));
    const productById = new Map(data.products.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    for (const match of data.matches) {
      const listing = listingById.get(match.listingId);
      const product = productById.get(match.productId);
      const monitor = listing ? monitorById.get(listing.monitorId) : undefined;
      expect(listing).toBeDefined();
      expect(product).toBeDefined();
      expect(monitor?.customerId).toBe(product?.customerId);
    }
  });

  it("never rejects an exact normalized title as low confidence", () => {
    const productById = new Map(data.products.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
    for (const match of data.matches.filter((row) => row.status === "rejected")) {
      expect(normalize(listingById.get(match.listingId)?.title ?? "")).not.toBe(
        normalize(productById.get(match.productId)?.title ?? ""),
      );
    }
  });

  it("keeps listing and match timestamps causal", () => {
    const runById = new Map(data.runs.map((row) => [row.id, row]));
    const listingById = new Map(data.listings.map((row) => [row.id, row]));
    for (const listing of data.listings) {
      const run = runById.get(listing.runId);
      expect(run).toBeDefined();
      expect(listing.scrapedAt.getTime()).toBeGreaterThanOrEqual(run?.startedAt.getTime() ?? 0);
      expect(listing.scrapedAt.getTime()).toBeLessThanOrEqual(
        run?.finishedAt?.getTime() ?? Number.POSITIVE_INFINITY,
      );
    }
    for (const match of data.matches) {
      expect(match.matchedAt.getTime()).toBeGreaterThanOrEqual(
        listingById.get(match.listingId)?.scrapedAt.getTime() ?? Number.POSITIVE_INFINITY,
      );
    }
  });
});
