import type { Adapter, ColumnMeta } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { drawerRoute } from "../drawer/drawer-route";
import { declaredRowFields } from "../runtime/project-row";

const column = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: false,
  unique: name === "uuid",
  primaryKey: name === "uuid",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "keys", columns: ["uuid", "label"].map(column), primaryKey: "uuid" }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async (_ref, ctx) => ({ uuid: ctx.id, label: "Main key" }),
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [resource({ __name: "keys" }, { columns: ["label"], drawer: { fields: "*" } })],
});

describe("a table keyed by uuid without rowKey", () => {
  it("resolves rowKey to the primary key once, in defineAdmin", () => {
    expect(config.resourcesByName.get("keys")?.options.rowKey).toBe("uuid");
  });

  it("projects and names rows by that key instead of a missing id", async () => {
    const keys = config.resourcesByName.get("keys");
    if (!keys) throw new Error("keys resource missing");
    expect([...declaredRowFields(keys)]).toContain("uuid");
    expect([...declaredRowFields(keys)]).not.toContain("id");
    const res = await drawerRoute(config)(new Request("http://localhost/x"), {
      params: Promise.resolve({ resource: "keys", id: "7f1c" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { title: string }).title).toBe("7f1c");
  });

  it("keeps a declared rowKey", () => {
    const declared = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [resource({ __name: "keys" }, { columns: ["label"], rowKey: "label" })],
    });
    expect(declared.resourcesByName.get("keys")?.options.rowKey).toBe("label");
  });
});
