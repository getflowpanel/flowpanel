import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";

describe("ScrapeAI domain schema", () => {
  const domainTables = [
    schema.customers,
    schema.monitors,
    schema.runs,
    schema.products,
    schema.listings,
    schema.matches,
    schema.invoices,
    schema.aiUsage,
  ];

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

  it("stores lifecycle metadata for private demo sandboxes", () => {
    expect(getTableName(schema.demoSandboxes)).toBe("demo_sandboxes");
    expect(getTableName(schema.demoMaintenance)).toBe("demo_maintenance");
    expect(getTableConfig(schema.demoSandboxes).columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        "id",
        "seed_version",
        "created_at",
        "last_seen_at",
        "inactivity_expires_at",
        "absolute_expires_at",
        "last_reset_at",
        "fingerprint_hash",
      ]),
    );
  });

  it("assigns every demo row to one sandbox and retains generator seed keys", () => {
    for (const table of domainTables) {
      const columns = getTableConfig(table).columns.map((column) => column.name);
      expect(columns).toContain("sandbox_id");
      expect(columns).toContain("seed_key");
    }
  });

  it("protects relational ownership with composite foreign keys", () => {
    for (const table of [
      schema.monitors,
      schema.runs,
      schema.products,
      schema.listings,
      schema.matches,
      schema.invoices,
      schema.aiUsage,
    ]) {
      expect(
        getTableConfig(table).foreignKeys.some(
          (foreignKey) => foreignKey.reference().columns.length === 2,
        ),
      ).toBe(true);
    }
  });

  it("cascades every dependent row removed by a supported parent hard delete", () => {
    const contracts = [
      [schema.runs, ["sandbox_id", "monitor_id"]],
      [schema.listings, ["sandbox_id", "monitor_id"]],
      [schema.matches, ["sandbox_id", "listing_id"]],
      [schema.matches, ["sandbox_id", "product_id"]],
      [schema.aiUsage, ["sandbox_id", "run_id"]],
    ] as const;

    for (const [table, columns] of contracts) {
      const foreignKey = getTableConfig(table).foreignKeys.find((candidate) => {
        const actual = candidate.reference().columns.map((column) => column.name);
        return (
          actual.length === columns.length && actual.every((column, i) => column === columns[i])
        );
      });

      expect(foreignKey, `missing foreign key for ${columns.join(", ")}`).toBeDefined();
      expect(foreignKey?.onDelete).toBe("cascade");
    }
  });

  it("keeps historical offers when their run is retained or protected from hard deletion", () => {
    const expected = ["sandbox_id", "run_id"];
    const runForeignKey = getTableConfig(schema.listings).foreignKeys.find((candidate) => {
      const actual = candidate.reference().columns.map((column) => column.name);
      return (
        actual.length === expected.length && actual.every((column, i) => column === expected[i])
      );
    });

    expect(schema.listings.runId.notNull).toBe(false);
    expect(runForeignKey?.onDelete).toBe("no action");
  });

  it("does not cascade through customer relations because customer deletion is soft", () => {
    for (const table of [schema.monitors, schema.products, schema.invoices, schema.aiUsage]) {
      const customerForeignKey = getTableConfig(table).foreignKeys.find((candidate) =>
        candidate.reference().columns.some((column) => column.name === "customer_id"),
      );

      expect(customerForeignKey).toBeDefined();
      expect(customerForeignKey?.onDelete).toBe("no action");
    }
  });

  it("declares composite parent constraints before child foreign keys", () => {
    for (const table of domainTables) {
      const config = getTableConfig(table);
      const constraintColumns = config.uniqueConstraints.map((constraint) =>
        constraint.columns.map((column) => column.name),
      );
      expect(constraintColumns).toContainEqual(["sandbox_id", "id"]);
    }
  });

  it("keeps generator keys unique inside each sandbox", () => {
    for (const table of domainTables) {
      const config = getTableConfig(table);
      const indexColumns = config.indexes.map((index) =>
        index.config.columns.map((column) =>
          "name" in column && typeof column.name === "string" ? column.name : undefined,
        ),
      );
      expect(indexColumns).toContainEqual(["sandbox_id", "seed_key"]);
    }
  });
});
