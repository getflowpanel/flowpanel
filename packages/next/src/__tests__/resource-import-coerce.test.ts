import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../runtime/publish", () => ({
  publish: vi.fn(),
  publishResource: vi.fn(),
  bindPublisher: vi.fn(),
}));

import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { z } from "zod";
import { importRoute } from "../actions/resource-import";

// Mirrors what `createInsertSchema(table)` (drizzle-zod) actually produces —
// plain, non-coercing `z.number()` / `z.boolean()` / `z.date()` — so this
// test fails the way it did in production before the import route coerced
// CSV/JSON string cells to their column's real type.
const createSchema = z.object({
  email: z.string().email(),
  age: z.number().nullable().optional(),
  active: z.boolean(),
});

function makeConfig() {
  const created: unknown[] = [];
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({
      name: "users",
      primaryKey: "id",
      columns: [
        { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
        { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
        { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
        { name: "active", type: "boolean", nullable: false, unique: false, primaryKey: false },
      ],
    }),
    inferSchema: () => ({ create: createSchema, update: createSchema.partial() }) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async () => null,
    create: async (_ref, mctx) => {
      created.push((mctx as { input: unknown }).input);
      return { id: `u${created.length}` } as Record<string, unknown>;
    },
    update: async () => null,
    delete: async () => undefined,
  };
  const resource: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [{ field: "id" }, { field: "email" }, { field: "age" }, { field: "active" }],
      import: { formats: ["csv", "json"] },
    },
  } as never;
  const config: ResolvedAdminConfig = {
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource],
    resourcesByName: new Map([["users", resource]]),
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
  return { config, created };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/flowpanel/users/import", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = { params: Promise.resolve({ resource: "users" }) };

describe("importRoute — column-type coercion", () => {
  it("coerces CSV number/boolean cells to their column's real JS type before create", async () => {
    const { config, created } = makeConfig();
    const content = "email,age,active\na@b.com,30,true\nc@d.com,41,false";
    const res = await importRoute(config)(post({ format: "csv", content }), params);
    const body = (await res.json()) as { imported: number; failed: unknown[] };
    expect(body.failed).toEqual([]);
    expect(body.imported).toBe(2);
    expect(created).toEqual([
      { email: "a@b.com", age: 30, active: true },
      { email: "c@d.com", age: 41, active: false },
    ]);
  });

  it("maps a blank CSV cell to null for a nullable numeric column, not an empty string", async () => {
    const { config, created } = makeConfig();
    const content = "email,age,active\na@b.com,,true";
    const res = await importRoute(config)(post({ format: "csv", content }), params);
    const body = (await res.json()) as { imported: number; failed: unknown[] };
    expect(body.imported).toBe(1);
    expect(created).toEqual([{ email: "a@b.com", age: null, active: true }]);
  });

  it("reports a clear per-row field error for an unparseable number, not a NaN write", async () => {
    const { config, created } = makeConfig();
    const content = "email,age,active\na@b.com,not-a-number,true";
    const res = await importRoute(config)(post({ format: "csv", content }), params);
    const body = (await res.json()) as {
      imported: number;
      failed: { row: number; error: string }[];
    };
    expect(body.imported).toBe(0);
    expect(created).toEqual([]);
    expect(body.failed).toHaveLength(1);
    expect(body.failed[0]?.error).toMatch(/^age: .*not a valid number/);
  });

  it("reports a clear per-row field error for an unparseable boolean", async () => {
    const { config, created } = makeConfig();
    const content = "email,age,active\na@b.com,30,maybe";
    const res = await importRoute(config)(post({ format: "csv", content }), params);
    const body = (await res.json()) as { failed: { row: number; error: string }[] };
    expect(created).toEqual([]);
    expect(body.failed[0]?.error).toMatch(/^active: .*not a valid boolean/);
  });

  it("leaves already-typed JSON values (real number/boolean) untouched", async () => {
    const { config, created } = makeConfig();
    const content = JSON.stringify([{ email: "a@b.com", age: 30, active: true }]);
    const res = await importRoute(config)(post({ format: "json", content }), params);
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(1);
    expect(created).toEqual([{ email: "a@b.com", age: 30, active: true }]);
  });
});
