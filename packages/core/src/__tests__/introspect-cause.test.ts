import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { defineAdmin, resource } from "../index";

const broken = new Error('relation "users" does not exist');

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => {
    throw broken;
  },
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

describe("a ref the adapter cannot introspect", () => {
  it("keeps the adapter's own error as the cause of the boot error", () => {
    let thrown: unknown;
    try {
      defineAdmin({ adapter, resources: [resource({ __name: "users" }, {})] } as never);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/could not introspect/);
    expect((thrown as Error).cause).toBe(broken);
  });

  it("still boots a resource that declares its columns", () => {
    expect(() =>
      defineAdmin({
        adapter,
        resources: [resource({ __name: "users" }, { columns: ["email"] })],
      } as never),
    ).not.toThrow();
  });
});
