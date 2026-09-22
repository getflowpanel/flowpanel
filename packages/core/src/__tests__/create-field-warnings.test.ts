import { afterEach, describe, expect, it, vi } from "vitest";
import type { Adapter, ColumnMeta } from "../index";
import { defineAdmin, resource } from "../index";

function meta(name: string, over: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name,
    type: "string",
    nullable: false,
    unique: false,
    primaryKey: name === "id",
    ...over,
  };
}

const COLUMNS = [
  meta("id", { generated: true }),
  meta("email"),
  meta("name", { nullable: true }),
  meta("createdAt", { type: "date", generated: true }),
];

function adapterWith(columns: ColumnMeta[]): Adapter {
  return {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns, primaryKey: "id" }),
    inferSchema: () =>
      ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
    get: async () => null,
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
}

const auth = { session: async () => null, role: () => "admin" };

function admin(options: Record<string, unknown>, columns = COLUMNS) {
  return defineAdmin({
    adapter: adapterWith(columns),
    auth: { ...auth, requireRole: "admin" },
    resources: [resource({ __name: "users" }, options as never)],
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a create form that cannot succeed", () => {
  it("names the resource, the column and the consequence", () => {
    const { warnings } = admin({
      columns: ["id", "email"],
      create: { fields: [{ name: "name" }] },
    });
    expect(warnings).toEqual([
      "resource users: create is enabled but required column `email` has no field; creation will always fail",
    ]);
  });

  it("stays quiet when the field is declared", () => {
    expect(
      admin({ columns: ["id", "email"], create: { fields: [{ name: "email" }] } }).warnings,
    ).toEqual([]);
  });

  it("falls back to the column list when create declares no fields", () => {
    expect(admin({ columns: ["id", "email"] }).warnings).toEqual([]);
    expect(admin({ columns: ["id"] }).warnings).toEqual([
      "resource users: create is enabled but required column `email` has no field; creation will always fail",
    ]);
  });

  it("ignores generated, primary-key and nullable columns", () => {
    expect(admin({ columns: ["email"] }).warnings).toEqual([]);
  });

  it("counts a value the server fills itself as offered", () => {
    expect(
      admin({ columns: ["id"], create: { defaultValues: { email: "a@b.c" } } }).warnings,
    ).toEqual([]);
    expect(
      admin({
        columns: ["id"],
        create: { fields: [{ name: "name" }], defaultValues: { email: "a@b.c" } },
      }).warnings,
    ).toEqual([]);
  });

  it("says nothing about a column the database fills itself", () => {
    const columns = [meta("id", { generated: true }), meta("email", { hasDefault: true })];
    expect(admin({ columns: ["id"] }, columns).warnings).toEqual([]);
  });

  it("says nothing about a resource that cannot be created", () => {
    expect(admin({ columns: ["id"], create: { disabled: true } }).warnings).toEqual([]);
  });

  it("says nothing on a read-only admin", () => {
    const config = defineAdmin({
      adapter: adapterWith(COLUMNS),
      auth,
      readOnly: true,
      resources: [resource({ __name: "users" }, { columns: ["id"] })],
    });
    expect(config.warnings).toEqual([]);
  });

  it("prints once per process in development and never in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");
    admin({ columns: ["id"] });
    expect(warn).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "development");
    admin({ columns: ["id"] });
    const calls = warn.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    admin({ columns: ["id"] });
    expect(warn.mock.calls).toHaveLength(calls);
  });
});
