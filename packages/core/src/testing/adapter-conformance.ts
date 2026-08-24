import type { Adapter } from "../types/adapter.js";
import { type AdapterCapabilities, adapterCapabilities } from "../types/adapter-v2.js";

/** Fail fast when a shipped adapter overclaims a capability. */
export function assertAdapterCapabilities(adapter: Adapter): AdapterCapabilities {
  const capabilities = adapterCapabilities(adapter);
  if (capabilities.atomicImport && !capabilities.transactions) {
    throw new Error("adapter capability atomicImport requires transactions");
  }
  if (capabilities.transactions && typeof adapter.transaction !== "function") {
    throw new Error("adapter declares transactions without implementing transaction()");
  }
  const migrationMethods = [
    adapter.runMigrationSql,
    adapter.listAppliedMigrations,
    adapter.markMigrationApplied,
  ];
  if (capabilities.migrations && migrationMethods.some((method) => typeof method !== "function")) {
    throw new Error("adapter declares migrations without implementing every migration method");
  }
  return capabilities;
}
