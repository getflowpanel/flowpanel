import { describe, expect, it } from "vitest";
import { assertAdapterCapabilities } from "../testing/adapter-conformance.js";
import type { Adapter } from "../types/adapter.js";
import { adapterCapabilities, bindAdapterScope } from "../types/adapter-v2.js";

const base = {
  kind: "test",
  db: {},
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => null,
  delete: async () => {},
} satisfies Adapter;

describe("adapter v2 contract", () => {
  it("keeps third-party v1 adapters fail-safe through conservative capabilities", () => {
    expect(adapterCapabilities(base)).toEqual({
      version: 2,
      projections: false,
      transactions: false,
      atomicImport: false,
      returningRows: false,
      migrations: false,
    });
  });

  it("rejects capability claims the adapter cannot honor", () => {
    expect(() =>
      assertAdapterCapabilities({
        ...base,
        capabilities: {
          version: 2,
          projections: true,
          transactions: true,
          atomicImport: true,
          returningRows: true,
          migrations: false,
        },
      }),
    ).toThrow(/without implementing transaction/);
  });

  it("creates an immutable opaque bound scope", () => {
    const scope = bindAdapterScope((query) => ({ query, tenantId: "t1" }));
    expect(scope.kind).toBe("flowpanel.bound-scope");
    expect(scope.apply({ id: "1" })).toEqual({ query: { id: "1" }, tenantId: "t1" });
    expect(Object.isFrozen(scope)).toBe(true);
  });
});
