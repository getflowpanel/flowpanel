import type { DemoData } from "../data/types";

type IdMap = Map<number, number>;

export class SeedMappingError extends Error {
  override name = "SeedMappingError";
}

function mappedId(map: IdMap, seedKey: number, relation: string): number {
  const id = map.get(seedKey);
  if (id === undefined) {
    throw new SeedMappingError(`Missing inserted id for ${relation} seed key ${seedKey}`);
  }
  return id;
}

function owned<Row extends { id: number }>(row: Row, sandboxId: string) {
  const { id, ...values } = row;
  return { ...values, sandboxId, seedKey: id };
}

export const seedRows = {
  customers(data: DemoData, sandboxId: string) {
    return data.customers.map((row) => owned(row, sandboxId));
  },

  monitors(data: DemoData, sandboxId: string, customerIds: IdMap) {
    return data.monitors.map((row) => ({
      ...owned(row, sandboxId),
      customerId: mappedId(customerIds, row.customerId, "monitor.customer"),
    }));
  },

  runs(data: DemoData, sandboxId: string, monitorIds: IdMap) {
    return data.runs.map((row) => ({
      ...owned(row, sandboxId),
      monitorId: mappedId(monitorIds, row.monitorId, "run.monitor"),
    }));
  },

  products(data: DemoData, sandboxId: string, customerIds: IdMap) {
    return data.products.map((row) => ({
      ...owned(row, sandboxId),
      customerId: mappedId(customerIds, row.customerId, "product.customer"),
    }));
  },

  listings(data: DemoData, sandboxId: string, ids: { monitors: IdMap; runs: IdMap }) {
    return data.listings.map((row) => ({
      ...owned(row, sandboxId),
      monitorId: mappedId(ids.monitors, row.monitorId, "listing.monitor"),
      runId: mappedId(ids.runs, row.runId, "listing.run"),
    }));
  },

  matches(data: DemoData, sandboxId: string, ids: { listings: IdMap; products: IdMap }) {
    return data.matches.map((row) => ({
      ...owned(row, sandboxId),
      listingId: mappedId(ids.listings, row.listingId, "match.listing"),
      productId: mappedId(ids.products, row.productId, "match.product"),
    }));
  },

  invoices(data: DemoData, sandboxId: string, customerIds: IdMap) {
    return data.invoices.map((row) => ({
      ...owned(row, sandboxId),
      customerId: mappedId(customerIds, row.customerId, "invoice.customer"),
    }));
  },

  aiUsage(data: DemoData, sandboxId: string, ids: { customers: IdMap; runs: IdMap }) {
    return data.aiUsage.map((row) => ({
      ...owned(row, sandboxId),
      customerId:
        row.customerId === null
          ? null
          : mappedId(ids.customers, row.customerId, "aiUsage.customer"),
      runId: row.runId === null ? null : mappedId(ids.runs, row.runId, "aiUsage.run"),
    }));
  },
};
