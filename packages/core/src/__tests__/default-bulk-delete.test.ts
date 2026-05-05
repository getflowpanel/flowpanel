import { describe, expect, it } from "vitest";
import type { Adapter, BulkAction } from "../index.js";
import { defineAdmin, resource } from "../index.js";

const noopAdapter: Adapter = {
  kind: "drizzle",
  db: null,
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

describe("defaultBulkActions — auto-injected delete", () => {
  it("adds a BulkAction 'delete' when delete is enabled and bulkActions is undefined", () => {
    const cfg = defineAdmin({
      adapter: noopAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource({ __name: "users" }, { columns: [] })],
    });
    const users = cfg.resourcesByName.get("users");
    const bulk = users?.options.bulkActions;
    expect(bulk).toHaveLength(1);
    expect(bulk?.[0]?.key).toBe("delete");
    expect(bulk?.[0]?.variant).toBe("destructive");
  });

  it("does NOT override explicit bulkActions", () => {
    const custom: BulkAction<unknown> = {
      key: "archive",
      label: "Archive",
      run: async () => ({ ok: true }),
    };
    const cfg = defineAdmin({
      adapter: noopAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource({ __name: "users" }, { columns: [], bulkActions: [custom] })],
    });
    const users = cfg.resourcesByName.get("users");
    expect(users?.options.bulkActions).toEqual([custom]);
  });

  it("does NOT add delete when resource.delete.disabled is true", () => {
    const cfg = defineAdmin({
      adapter: noopAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource({ __name: "users" }, { columns: [], delete: { disabled: true } })],
    });
    const users = cfg.resourcesByName.get("users");
    expect(users?.options.bulkActions ?? []).toHaveLength(0);
  });
});
