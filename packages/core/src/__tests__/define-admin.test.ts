import { describe, expect, it } from "vitest";
import type { Adapter } from "../index.js";
import { defineAdmin, resource, table } from "../index.js";

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

  it("derives name from Drizzle's Symbol(drizzle:BaseName)", () => {
    const baseNameSym = Symbol("drizzle:BaseName");
    const ref = { [baseNameSym]: "invoices" };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource(ref as unknown as Record<string, never>, { columns: [] })],
    });
    expect(config.resourcesByName.has("invoices")).toBe(true);
  });

  it("readOnly strips every write affordance from resources", () => {
    const ref = { __name: "users" };
    const config = defineAdmin({
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "guest" },
      readOnly: true,
      resources: [
        resource(ref, {
          columns: ["email", { field: "name", editable: true }],
          create: { fields: [{ name: "email" }] },
          import: { formats: ["csv"] },
          delete: { softDelete: "deletedAt" },
          actions: [{ key: "ping", label: "Ping", run: async () => ({ ok: true }) }],
          drawer: {
            actions: [{ key: "disable", label: "Disable", run: async () => ({ ok: true }) }],
          },
        }),
      ],
    });
    const opts = config.resourcesByName.get("users")?.options;
    expect(opts?.create?.disabled).toBe(true);
    expect(opts?.update?.disabled).toBe(true);
    expect(opts?.delete?.disabled).toBe(true);
    expect(opts?.actions).toEqual([]);
    expect(opts?.bulkActions).toEqual([]);
    expect(opts?.drawer?.actions).toEqual([]);
    // import (a bulk create) is removed entirely — no toolbar Import button.
    expect(opts?.import).toBeUndefined();
    // editable column made static; the create.fields config is preserved.
    expect((opts?.columns[1] as { editable?: boolean }).editable).toBe(false);
    expect(opts?.create?.fields).toHaveLength(1);
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

describe("defineAdmin cross-resource references", () => {
  const base = {
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "guest" as const },
  };

  it("accepts a column reference to a registered resource", () => {
    const config = defineAdmin({
      ...base,
      resources: [
        resource({ __name: "users" }, { columns: ["email"] }),
        resource(
          { __name: "orders" },
          { columns: [{ field: "userId", reference: { resource: "users", labelField: "email" } }] },
        ),
      ],
    });
    expect(config.resourcesByName.size).toBe(2);
  });

  it("throws on a column reference to an unregistered resource, with a suggestion", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource({ __name: "ai_usage" }, { columns: ["tokens"] }),
          resource(
            { __name: "runs" },
            {
              columns: [
                { field: "usageId", reference: { resource: "aiUsage", labelField: "tokens" } },
              ],
            },
          ),
        ],
      }),
    ).toThrow(
      /resource "runs" points at resource "aiUsage" via columns\[0\]\.reference\.resource.*Did you mean "ai_usage"\?.*Registered: "ai_usage", "runs"\./s,
    );
  });

  it("throws on a drawer tab pointing at an unregistered resource", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["email"],
              drawer: { tabs: [{ key: "o", label: "Orders", resource: "order" }] },
            },
          ),
        ],
      }),
    ).toThrow(/drawer\.tabs\[0\]\.resource/);
  });

  it("throws on a detail tab pointing at an unregistered resource", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["email"],
              detail: { tabs: [{ key: "o", label: "Orders", resource: "orders" }] },
            },
          ),
        ],
      }),
    ).toThrow(/detail\.tabs\[0\]\.resource/);
  });

  it("throws on a dashboard table widget pointing at an unregistered resource", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [resource({ __name: "users" }, { columns: ["email"] })],
        dashboards: [
          {
            path: "/",
            label: "Overview",
            sections: [{ widgets: [table({ resource: "user", limit: 5 })] }],
          },
        ],
      }),
    ).toThrow(/dashboard "\/" points at resource "user" via sections\[0\]\.widgets\[0\]\.resource/);
  });

  it("throws on a table widget inside a drawer widget tab", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource(
            { __name: "users" },
            {
              columns: ["email"],
              drawer: {
                tabs: [{ key: "w", label: "Activity", widgets: [table({ resource: "runz" })] }],
              },
            },
          ),
        ],
      }),
    ).toThrow(/drawer\.tabs\[0\]\.widgets\[0\]\.resource/);
  });
});
