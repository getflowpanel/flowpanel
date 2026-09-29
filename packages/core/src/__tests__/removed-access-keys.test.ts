import { describe, expect, it } from "vitest";
import type { Adapter, ColumnMeta } from "../index";
import { dashboard, defineAdmin, resource } from "../index";

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: false,
  unique: false,
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: ["id", "email"].map(meta), primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const define = (options: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  defineAdmin({
    adapter,
    resources: [resource({ __name: "users" }, { columns: ["email"], ...options } as never)],
    ...extra,
  } as never);

describe("a config that gates access with requireRole where only access is read", () => {
  it("fails at boot on a resource instead of leaving it open", () => {
    expect(() => define({ requireRole: "admin" })).toThrow(/users.*requireRole.*access/);
  });

  it("fails at boot on a row, bulk or drawer action", () => {
    const action = { key: "ban", label: "Ban", requireRole: "admin", handler: async () => {} };
    expect(() => define({ actions: [action] })).toThrow(/users.*ban.*requireRole.*access/);
    expect(() => define({ bulkActions: [action] })).toThrow(/ban.*requireRole/);
    expect(() => define({ drawer: { actions: [action] } })).toThrow(/ban.*requireRole/);
  });

  it("fails at boot on a dashboard action", () => {
    const board = dashboard({
      path: "/",
      label: "Overview",
      sections: [],
      actions: [{ key: "sync", label: "Sync", requireRole: "admin", handler: async () => {} }],
    } as never);
    expect(() => define({}, { dashboards: [board] })).toThrow(/sync.*requireRole.*access/);
  });
});

describe("options that were renamed", () => {
  it("fail at boot instead of being ignored", () => {
    expect(() => define({ detail: { header: () => "x" } })).toThrow(
      /users.*detail\.header.*detail\.title/,
    );
    expect(() => define({ drawer: { header: () => "x" } })).toThrow(
      /users.*drawer\.header.*drawer\.title/,
    );
    expect(() => define({}, { basePath: "/ops" })).toThrow(/basePath.*paths\.admin/);
  });
});

describe("resolveOperationAccess", () => {
  it("rejects anything but a resource operation, so a stale call cannot read as allowed", async () => {
    const { resolveOperationAccess } = await import("../policy/access");
    expect(resolveOperationAccess({ read: "admin" }, "read")).toBe("admin");
    expect(() => resolveOperationAccess({ read: "admin" }, undefined as never)).toThrow(
      /Unknown resource operation/,
    );
  });
});
