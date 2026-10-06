import { describe, expect, it } from "vitest";
import {
  type Adapter,
  type ColumnMeta,
  defineAdmin,
  type ResourceOptions,
  resource,
} from "../index";
import { writeTarget } from "../internal/write-target";

const meta = (name: string, primaryKey = false): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey,
});

const refs = {
  view: { __name: "admin_user_row" },
  table: { __name: "user" },
  keyed: { __name: "account" },
  otherView: { __name: "other_row" },
};

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    if (ref === refs.view || ref === refs.otherView) {
      return {
        name: (ref as { __name: string }).__name,
        kind: "view",
        columns: [meta("id", true), meta("name"), meta("lifecycle"), meta("internal")],
        primaryKey: "id",
      };
    }
    if (ref === refs.keyed) {
      return { name: "account", columns: [meta("uid", true), meta("name")], primaryKey: "uid" };
    }
    return {
      name: "user",
      columns: [meta("id", true), meta("name"), meta("internal"), meta("role")],
      primaryKey: "id",
    };
  },
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

type Row = Record<string, unknown>;

function admin(options: Partial<ResourceOptions<Row>>) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource(refs.view, { name: "user", columns: ["id", "name"], ...options })],
  });
}

describe("a resource over a view", () => {
  it("is read-only without writeTo, with no injected bulk delete", () => {
    const user = admin({}).resourcesByName.get("user");
    expect(user?.options.create?.disabled).toBe(true);
    expect(user?.options.update?.disabled).toBe(true);
    expect(user?.options.delete?.disabled).toBe(true);
    expect(user?.options.bulkActions ?? []).toEqual([]);
  });

  it("refuses a declared write without writeTo", () => {
    expect(() => admin({ update: { fields: [{ name: "internal" }] } })).toThrow(
      'flowpanel: resource "user" reads the view "admin_user_row" and cannot write (update); ' +
        "set writeTo: <table> or disable create/update/delete",
    );
    expect(() => admin({ import: { formats: ["csv"] } })).toThrow(/cannot write \(import\)/);
  });

  it("keeps writes with writeTo and checks form fields against the table", () => {
    const user = admin({
      writeTo: refs.table,
      update: { fields: [{ name: "internal" }] },
    }).resourcesByName.get("user");
    expect(user?.options.update?.disabled).toBeUndefined();
    expect(writeTarget(user as never)).toBe(refs.table);
    expect(() =>
      admin({ writeTo: refs.table, update: { fields: [{ name: "lifecycle" }] } }),
    ).toThrow(
      'flowpanel: resource "user" writes "lifecycle" via update.fields[0].name, but its writeTo ' +
        '"user" has no such column. Known columns: "id", "name", "internal", "role".',
    );
    expect(() =>
      admin({ writeTo: refs.table, columns: ["id", { field: "lifecycle", editable: true }] }),
    ).toThrow(
      'flowpanel: resource "user" writes "lifecycle" via columns[1].field, but its writeTo ' +
        '"user" has no such column. Known columns: "id", "name", "internal", "role".',
    );
  });

  it("needs the write target's key among the view's columns, and a table", () => {
    expect(() => admin({ writeTo: refs.keyed })).toThrow(
      'flowpanel: resource "user" writes to "account", whose key "uid" is not a column of the ' +
        'view "admin_user_row". Select it in the view.',
    );
    expect(() => admin({ writeTo: refs.otherView })).toThrow(
      'flowpanel: resource "user" sets writeTo to the view "other_row"; writeTo must be a table.',
    );
  });

  it("reads the ref itself when there is no writeTo", () => {
    expect(writeTarget({ ref: refs.table, options: {} })).toBe(refs.table);
  });
});
