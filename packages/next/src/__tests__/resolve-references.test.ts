import type {
  Adapter,
  ColumnDef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { resolveReferences } from "../runtime/resolve-references.js";

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

function mkConfig(opts: {
  rows?: Map<string, Record<string, unknown> | null>;
  resources?: ResourceConfig[];
}): { config: ResolvedAdminConfig; getCalls: { id: string }[] } {
  const getCalls: { id: string }[] = [];
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
    get: async (_ref, ctx) => {
      getCalls.push({ id: ctx.id });
      const row = opts.rows?.get(ctx.id);
      return row ?? null;
    },
    create: async () => ({}),
    update: async () => ({}),
    delete: async () => undefined,
  };
  const byName = new Map<string, ResourceConfig>();
  for (const r of opts.resources ?? []) {
    byName.set((r.ref as { __name?: string }).__name ?? "?", r);
  }
  return {
    config: {
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: opts.resources ?? [],
      resourcesByName: byName,
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never,
    getCalls,
  };
}

const usersResource: ResourceConfig = {
  __kind: "resource",
  ref: { __name: "users" },
  options: { columns: [{ field: "id" }, { field: "email" }] },
} as never;

describe("resolveReferences", () => {
  it("returns empty map when rows is empty", async () => {
    const { config } = mkConfig({});
    const out = await resolveReferences(
      config,
      reqCtx,
      [{ field: "x" }] as ColumnDef<Record<string, unknown>>[],
      [],
    );
    expect(out.size).toBe(0);
  });

  it("skips string-only column entries", async () => {
    const { config, getCalls } = mkConfig({});
    const rows = [{ userId: "u1" }];
    await resolveReferences(config, reqCtx, ["userId" as never], rows);
    expect(getCalls).toEqual([]);
  });

  it("skips columns without a reference", async () => {
    const { config, getCalls } = mkConfig({});
    await resolveReferences(
      config,
      reqCtx,
      [{ field: "name" } as ColumnDef<Record<string, unknown>>],
      [{ name: "x" }],
    );
    expect(getCalls).toEqual([]);
  });

  it("skips columns when the referenced resource is not registered", async () => {
    const { config, getCalls } = mkConfig({});
    await resolveReferences(
      config,
      reqCtx,
      [
        {
          field: "userId",
          reference: { resource: "ghost", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "u1" }],
    );
    expect(getCalls).toEqual([]);
  });

  it("looks up the FK and emits a labelField map keyed by stringified id", async () => {
    const rows = new Map<string, Record<string, unknown>>([
      ["u1", { id: "u1", email: "alice@x.com" }],
      ["u2", { id: "u2", email: "bob@x.com" }],
    ]);
    const { config, getCalls } = mkConfig({ rows, resources: [usersResource] });
    const out = await resolveReferences(
      config,
      reqCtx,
      [
        {
          field: "userId",
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "u1" }, { userId: "u2" }, { userId: "u1" }],
    );
    expect(getCalls.map((c) => c.id).sort()).toEqual(["u1", "u2"]);
    const userMap = out.get("userId");
    expect(userMap?.get("u1")).toBe("alice@x.com");
    expect(userMap?.get("u2")).toBe("bob@x.com");
  });

  it("drops null/undefined FK values from the lookup set", async () => {
    const rows = new Map<string, Record<string, unknown>>([["u1", { id: "u1", email: "a@x.com" }]]);
    const { config, getCalls } = mkConfig({ rows, resources: [usersResource] });
    await resolveReferences(
      config,
      reqCtx,
      [
        {
          field: "userId",
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "u1" }, { userId: null }, { userId: undefined }],
    );
    expect(getCalls.map((c) => c.id)).toEqual(["u1"]);
  });

  it("does not record an entry when all lookups return null or empty label", async () => {
    const { config } = mkConfig({
      rows: new Map([
        ["u1", null],
        ["u2", { id: "u2" }], // missing labelField
      ]),
      resources: [usersResource],
    });
    const out = await resolveReferences(
      config,
      reqCtx,
      [
        {
          field: "userId",
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "u1" }, { userId: "u2" }],
    );
    expect(out.has("userId")).toBe(false);
  });

  it("skips columns whose field is missing", async () => {
    const { config, getCalls } = mkConfig({ resources: [usersResource] });
    await resolveReferences(
      config,
      reqCtx,
      [
        {
          // no field
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "u1" }],
    );
    expect(getCalls).toEqual([]);
  });

  it("issues parallel adapter.get calls for unique ids", async () => {
    const rows = new Map<string, Record<string, unknown>>([
      ["a", { id: "a", email: "a@x" }],
      ["b", { id: "b", email: "b@x" }],
      ["c", { id: "c", email: "c@x" }],
    ]);
    const { config } = mkConfig({ rows, resources: [usersResource] });
    const spy = vi.spyOn(config.adapter, "get");
    await resolveReferences(
      config,
      reqCtx,
      [
        {
          field: "userId",
          reference: { resource: "users", labelField: "email" },
        } as ColumnDef<Record<string, unknown>>,
      ],
      [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "a" }],
    );
    expect(spy).toHaveBeenCalledTimes(3); // deduped
  });
});
