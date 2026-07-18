import type {
  Adapter,
  ColumnDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { resolveReferences } from "../runtime/resolve-references.js";

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

interface ListCall {
  filters: Record<string, unknown>;
  pageSize: number;
  applyScope?: (query: unknown) => unknown;
  scopeRequired?: boolean;
}

function mkConfig(opts: {
  rows?: Map<string, Record<string, unknown> | null>;
  resources?: ResourceConfig[];
  globalScope?: boolean;
}): { config: ResolvedAdminConfig; listCalls: ListCall[] } {
  const listCalls: ListCall[] = [];
  const adapter: Adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
    inferSchema: () => ({}) as never,
    list: async (_ref, ctx: ListQueryContext<unknown>) => {
      listCalls.push({
        filters: ctx.filters,
        pageSize: ctx.pageSize,
        ...(ctx.applyScope ? { applyScope: ctx.applyScope } : {}),
        ...(ctx.scopeRequired !== undefined ? { scopeRequired: ctx.scopeRequired } : {}),
      });
      const filter = ctx.filters.id as { values?: string[] } | undefined;
      const ids = filter?.values ?? [];
      const rows = ids
        .map((id) => opts.rows?.get(id))
        .filter((r): r is Record<string, unknown> => !!r);
      return { rows, total: rows.length, page: 1, pageSize: ctx.pageSize };
    },
    get: async () => null,
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
      ...(opts.globalScope ? { scope: () => ({ tenantId: "t1" }) } : {}),
      __resolved: true,
    } as never,
    listCalls,
  };
}

function usersResource(options: Record<string, unknown> = {}): ResourceConfig {
  return {
    __kind: "resource",
    ref: { __name: "users" },
    options: { columns: [{ field: "id" }, { field: "email" }], ...options },
  } as never;
}

const userRefColumn = {
  field: "userId",
  reference: { resource: "users", labelField: "email" },
} as ColumnDef<Record<string, unknown>>;

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
    const { config, listCalls } = mkConfig({});
    await resolveReferences(config, reqCtx, ["userId" as never], [{ userId: "u1" }]);
    expect(listCalls).toEqual([]);
  });

  it("skips columns without a reference", async () => {
    const { config, listCalls } = mkConfig({});
    await resolveReferences(
      config,
      reqCtx,
      [{ field: "name" } as ColumnDef<Record<string, unknown>>],
      [{ name: "x" }],
    );
    expect(listCalls).toEqual([]);
  });

  it("skips columns when the referenced resource is not registered", async () => {
    const { config, listCalls } = mkConfig({});
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
    expect(listCalls).toEqual([]);
  });

  it("looks up the FK and emits a labelField map keyed by stringified id", async () => {
    const rows = new Map<string, Record<string, unknown>>([
      ["u1", { id: "u1", email: "alice@x.com" }],
      ["u2", { id: "u2", email: "bob@x.com" }],
    ]);
    const { config } = mkConfig({ rows, resources: [usersResource()] });
    const out = await resolveReferences(
      config,
      reqCtx,
      [userRefColumn],
      [{ userId: "u1" }, { userId: "u2" }, { userId: "u1" }],
    );
    const userMap = out.get("userId");
    expect(userMap?.get("u1")).toBe("alice@x.com");
    expect(userMap?.get("u2")).toBe("bob@x.com");
  });

  it("batches every distinct id into ONE adapter.list call", async () => {
    const rows = new Map<string, Record<string, unknown>>([
      ["a", { id: "a", email: "a@x" }],
      ["b", { id: "b", email: "b@x" }],
      ["c", { id: "c", email: "c@x" }],
    ]);
    const { config, listCalls } = mkConfig({ rows, resources: [usersResource()] });
    await resolveReferences(
      config,
      reqCtx,
      [userRefColumn],
      [{ userId: "a" }, { userId: "b" }, { userId: "c" }, { userId: "a" }],
    );
    expect(listCalls).toHaveLength(1);
    expect(listCalls[0]?.filters).toEqual({ id: { op: "in", values: ["a", "b", "c"] } });
    expect(listCalls[0]?.pageSize).toBe(3);
  });

  it("drops null/undefined FK values from the lookup set", async () => {
    const rows = new Map<string, Record<string, unknown>>([["u1", { id: "u1", email: "a@x.com" }]]);
    const { config, listCalls } = mkConfig({ rows, resources: [usersResource()] });
    await resolveReferences(
      config,
      reqCtx,
      [userRefColumn],
      [{ userId: "u1" }, { userId: null }, { userId: undefined }],
    );
    expect(listCalls[0]?.filters).toEqual({ id: { op: "in", values: ["u1"] } });
  });

  it("issues no query at all when every FK value is null", async () => {
    const { config, listCalls } = mkConfig({ resources: [usersResource()] });
    await resolveReferences(config, reqCtx, [userRefColumn], [{ userId: null }]);
    expect(listCalls).toEqual([]);
  });

  it("does not record an entry when all lookups return null or empty label", async () => {
    const { config } = mkConfig({
      rows: new Map([
        ["u1", null],
        ["u2", { id: "u2" }], // missing labelField
      ]),
      resources: [usersResource()],
    });
    const out = await resolveReferences(
      config,
      reqCtx,
      [userRefColumn],
      [{ userId: "u1" }, { userId: "u2" }],
    );
    expect(out.has("userId")).toBe(false);
  });

  it("skips columns whose field is missing", async () => {
    const { config, listCalls } = mkConfig({ resources: [usersResource()] });
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
    expect(listCalls).toEqual([]);
  });

  it("does not read a role-gated target the viewer cannot access", async () => {
    const rows = new Map<string, Record<string, unknown>>([["u1", { id: "u1", email: "a@x.com" }]]);
    const { config, listCalls } = mkConfig({
      rows,
      resources: [usersResource({ requireRole: "superadmin" })],
    });
    const out = await resolveReferences(
      config,
      { ...reqCtx, role: "staff" },
      [userRefColumn],
      [{ userId: "u1" }],
    );
    expect(listCalls).toEqual([]);
    expect(out.has("userId")).toBe(false);
  });

  it("does not read a target that declares no scope while global scope is active", async () => {
    const rows = new Map<string, Record<string, unknown>>([["u1", { id: "u1", email: "a@x.com" }]]);
    const { config, listCalls } = mkConfig({
      rows,
      resources: [usersResource()],
      globalScope: true,
    });
    const out = await resolveReferences(config, reqCtx, [userRefColumn], [{ userId: "u1" }]);
    expect(listCalls).toEqual([]);
    expect(out.has("userId")).toBe(false);
  });

  it("binds the target's scope predicate to the request's scope value", async () => {
    const scopeCalls: unknown[][] = [];
    const rows = new Map<string, Record<string, unknown>>([["u1", { id: "u1", email: "a@x.com" }]]);
    const { config, listCalls } = mkConfig({
      rows,
      resources: [
        usersResource({
          scope: (scope: unknown, query: unknown) => {
            scopeCalls.push([scope, query]);
            return query;
          },
        }),
      ],
      globalScope: true,
    });
    await resolveReferences(
      config,
      { ...reqCtx, scope: { tenantId: "t1" } },
      [userRefColumn],
      [{ userId: "u1" }],
    );
    expect(listCalls[0]?.scopeRequired).toBe(true);
    listCalls[0]?.applyScope?.("q");
    expect(scopeCalls).toEqual([[{ tenantId: "t1" }, "q"]]);
  });
});
