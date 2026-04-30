import { describe, expect, it } from "vitest";
import type { Adapter } from "../index.js";
import { defineAdmin, resource } from "../index.js";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as any, update: {} as any, select: {} as any }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

describe("defineAdmin", () => {
  it("resolves a minimal config", () => {
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
    });
    expect(config.__resolved).toBe(true);
    expect(config.resourcesByName.size).toBe(0);
  });

  it("indexes resources by name derived from ref.__name", () => {
    const ref = { __name: "users" };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource(ref, { columns: [] })],
    });
    expect(config.resourcesByName.has("users")).toBe(true);
    expect(config.resourcesByName.get("users")?.ref).toBe(ref);
  });

  it("honours explicit resource name option", () => {
    const ref = { __name: "users" };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource(ref, { name: "customers", columns: [] })],
    });
    expect(config.resourcesByName.has("customers")).toBe(true);
    expect(config.resourcesByName.has("users")).toBe(false);
  });

  it("derives name from Drizzle-style _ field", () => {
    const ref = { _: { name: "jobs" } };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource(ref, { columns: [] })],
    });
    expect(config.resourcesByName.has("jobs")).toBe(true);
  });

  it("derives name from Drizzle's Symbol(drizzle:Name)", () => {
    const nameSym = Symbol("drizzle:Name");
    const ref = { [nameSym]: "payments" };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource(ref as unknown as Record<string, never>, { columns: [] })],
    });
    expect(config.resourcesByName.has("payments")).toBe(true);
  });

  it("throws if name cannot be resolved", () => {
    expect(() => {
      defineAdmin({
        adapter: fakeAdapter,
        auth: { session: async () => null, role: () => "guest" },
        resources: [resource({} as any, { columns: [] })],
      });
    }).toThrow(/name/i);
  });
});
