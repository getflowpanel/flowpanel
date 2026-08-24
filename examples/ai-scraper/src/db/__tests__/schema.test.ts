import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";

describe("ScrapeAI domain schema", () => {
  it("uses the same customer and monitor language as the UI", () => {
    expect(getTableName(schema.customers)).toBe("customers");
    expect(getTableName(schema.monitors)).toBe("monitors");
  });

  it("exposes domain-named foreign keys", () => {
    expect(schema.monitors.customerId).toBeDefined();
    expect(schema.runs.monitorId).toBeDefined();
    expect(schema.products.customerId).toBeDefined();
    expect(schema.listings.monitorId).toBeDefined();
    expect(schema.invoices.customerId).toBeDefined();
    expect(schema.aiUsage.customerId).toBeDefined();
  });
});
