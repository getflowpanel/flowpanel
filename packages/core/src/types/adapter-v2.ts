import type { Adapter } from "./adapter.js";

/** Opaque request-bound tenant policy understood by adapter v2 implementations. */
export interface BoundAdapterScope {
  readonly kind: "flowpanel.bound-scope";
  apply(query: unknown): unknown;
}

export function bindAdapterScope(apply: (query: unknown) => unknown): BoundAdapterScope {
  return Object.freeze({ kind: "flowpanel.bound-scope", apply });
}

export interface AdapterCapabilities {
  readonly version: 2;
  readonly projections: boolean;
  readonly transactions: boolean;
  readonly atomicImport: boolean;
  readonly returningRows: boolean;
  readonly migrations: boolean;
}

export interface AdapterV2<DB = unknown, Ref = unknown> extends Adapter<DB, Ref> {
  readonly capabilities: AdapterCapabilities;
  transaction?<T>(run: (db: DB) => Promise<T>): Promise<T>;
}

const V1_CAPABILITIES: AdapterCapabilities = Object.freeze({
  version: 2,
  projections: false,
  transactions: false,
  atomicImport: false,
  returningRows: false,
  migrations: false,
});

/** Internal 0.2 bridge for third-party v1 adapters. Removal target: 0.3. */
export function adapterCapabilities(adapter: Adapter): AdapterCapabilities {
  return adapter.capabilities ?? V1_CAPABILITIES;
}
