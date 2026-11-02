import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { defineAdmin, resource } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "user",
    columns: ["id", "plan", "isTest"].map((name) => ({
      name,
      type: "string",
      nullable: true,
      unique: false,
      primaryKey: name === "id",
    })),
    primaryKey: "id",
  }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function boot(filters: unknown[]) {
  return () =>
    defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [resource({ __name: "user" }, { columns: ["id"], filters: filters as never })],
    });
}

describe("a filter's defaultValue at defineAdmin", () => {
  it("accepts a default the list reads as the rows it names", () => {
    expect(
      boot([
        { field: "isTest", type: "boolean", defaultValue: false },
        { field: "plan", type: "multiselect", options: ["free", "pro"], defaultValue: ["pro"] },
      ]),
    ).not.toThrow();
  });

  it("names a default the list would read as other rows", () => {
    expect(boot([{ field: "plan", type: "select", defaultValue: ["free", "pro"] }])).toThrow(
      /filters\[0\]\.defaultValue: it filters "user" by "plan" = \["free","pro"\].*needs a "multiselect" filter there/,
    );
  });
});
