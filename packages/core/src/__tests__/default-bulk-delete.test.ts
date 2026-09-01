import { describe, expect, it } from "vitest";
import type { Adapter, BulkAction } from "../index";
import { defineAdmin, resource } from "../index";

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

  it("uses the resource's delete confirmation copy", () => {
    const cfg = defineAdmin({
      adapter: noopAdapter,
      auth: { session: async () => null, role: () => "guest" },
      resources: [
        resource(
          { __name: "offers" },
          { columns: [], delete: { confirm: "Also deletes related matches." } },
        ),
      ],
    });

    expect(cfg.resourcesByName.get("offers")?.options.bulkActions?.[0]?.confirm).toEqual({
      title: "Delete selected items?",
      description: "Also deletes related matches.",
    });
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

describe("action forms the dialog cannot serve", () => {
  const adapter = {
    kind: "test",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    inferSchema: () => ({ create: {}, update: {}, select: {} }),
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  } as never;

  function withActionForm(form: unknown[]) {
    return () =>
      defineAdmin({
        adapter,
        auth: { session: async () => null, role: () => "admin", allowUnauthenticated: true },
        resources: [
          resource("users", {
            name: "users",
            columns: ["id"],
            actions: [{ key: "assign", label: "Assign", form, run: async () => ({ ok: true }) }],
          } as never),
        ],
      });
  }

  it("refuses a reference picker it has no endpoint for", () => {
    expect(
      withActionForm([{ name: "owner", reference: { resource: "users", labelField: "email" } }]),
    ).toThrow(/reference/);
  });

  it("refuses options it would have to await", () => {
    expect(withActionForm([{ name: "plan", options: async () => [] }])).toThrow(/function/);
  });

  it("accepts a literal options array", () => {
    expect(withActionForm([{ name: "plan", options: ["free", "pro"] }])).not.toThrow();
  });
});
