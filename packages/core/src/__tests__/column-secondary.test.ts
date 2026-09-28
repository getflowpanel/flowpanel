import { describe, expect, it } from "vitest";
import { type Adapter, type ColumnMeta, defineAdmin, resource } from "../index";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "users",
    columns: ["id", "name", "email"].map(meta),
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

const admin = (secondary: string) =>
  defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource({ __name: "users" }, { columns: ["id", { field: "name", secondary }] })],
  });

describe("ColumnDef.secondary at defineAdmin", () => {
  it("accepts a column of the resource and names a misspelt one", () => {
    expect(() => admin("email")).not.toThrow();
    expect(() => admin("emial")).toThrow(
      /points at column "emial" via columns\[1\]\.secondary.*Did you mean "email"\?/s,
    );
  });
});
