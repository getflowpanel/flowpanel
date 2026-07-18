import type {
  Adapter,
  FieldDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields.js";

const ctx = (role: string): RequestContext => ({ role, session: null }) as RequestContext;

const config = {
  adapter: { db: {} },
  resourcesByName: new Map(),
} as unknown as ResolvedAdminConfig;

type Fields = FieldDef<Record<string, unknown>>[];

function resourceWith(options: Record<string, unknown>): ResourceConfig {
  return { __kind: "resource", ref: { __name: "r" }, options } as never;
}

describe("declaredFormFields", () => {
  const createFields: Fields = [{ name: "title" }];
  const updateFields: Fields = [{ name: "status" }];

  it("returns create.fields for create mode", () => {
    const r = resourceWith({ columns: [], create: { fields: createFields } });
    expect(declaredFormFields(r, "create")).toBe(createFields);
  });

  it("update mode falls back to create.fields when update.fields is omitted", () => {
    const r = resourceWith({ columns: [], create: { fields: createFields } });
    expect(declaredFormFields(r, "update")).toBe(createFields);
  });

  it("update mode prefers its own fields when declared", () => {
    const r = resourceWith({
      columns: [],
      create: { fields: createFields },
      update: { fields: updateFields },
    });
    expect(declaredFormFields(r, "update")).toBe(updateFields);
  });

  it("returns undefined when neither is declared", () => {
    const r = resourceWith({ columns: [] });
    expect(declaredFormFields(r, "update")).toBeUndefined();
  });
});

describe("resolveFormFields — hidden / readOnly / defaultValue", () => {
  it("drops hidden fields (boolean and row-predicate forms)", async () => {
    const fields: Fields = [
      { name: "title" },
      { name: "slug", hidden: true },
      { name: "archiveNote", hidden: (values) => values.status !== "archived" },
    ];
    const active = await resolveFormFields(config, fields, ctx("admin"), { status: "active" });
    expect(active.map((f) => f.name)).toEqual(["title"]);
    const archived = await resolveFormFields(config, fields, ctx("admin"), { status: "archived" });
    expect(archived.map((f) => f.name)).toEqual(["title", "archiveNote"]);
  });

  it("create forms evaluate predicates against empty values", async () => {
    const fields: Fields = [{ name: "title", readOnly: (values) => values.locked === true }];
    const resolved = await resolveFormFields(config, fields, ctx("admin"));
    expect(resolved[0]?.readOnly).toBeUndefined();
  });

  it("copies readOnly to the resolved field (boolean and predicate forms)", async () => {
    const fields: Fields = [
      { name: "sku", readOnly: true },
      { name: "title", readOnly: (values) => values.locked === true },
      { name: "note" },
    ];
    const resolved = await resolveFormFields(config, fields, ctx("admin"), { locked: true });
    expect(resolved.map((f) => f.readOnly)).toEqual([true, true, undefined]);
  });

  it("resolves defaultValue on create forms only (literal and async resolver)", async () => {
    const fields: Fields = [
      { name: "status", defaultValue: "draft" },
      { name: "owner", defaultValue: async () => "me" },
    ];
    const create = await resolveFormFields(config, fields, ctx("admin"));
    expect(create.map((f) => f.defaultValue)).toEqual(["draft", "me"]);
    const edit = await resolveFormFields(config, fields, ctx("admin"), { status: "live" });
    expect(edit.map((f) => f.defaultValue)).toEqual([undefined, undefined]);
  });
});

describe("resolveFormFields — reference fields (current-value label, not a preloaded list)", () => {
  const fields: Fields = [
    { name: "ownerId", reference: { resource: "users", labelField: "email" } },
  ];

  function configWith(opts: {
    rows?: Record<string, unknown>[];
    requireRole?: string;
    registerTarget?: boolean;
    targetScope?: unknown;
    globalScope?: boolean;
  }) {
    const rows = opts.rows ?? [{ id: "u42", email: "owner@x.com" }];
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows,
      total: rows.length,
      page: 1,
      pageSize: 20,
    }));
    const adapter = {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
      list,
    } as unknown as Adapter;
    const target: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: {
        columns: [],
        ...(opts.requireRole ? { requireRole: opts.requireRole } : {}),
        ...(opts.targetScope ? { scope: opts.targetScope } : {}),
      },
    } as never;
    const resourcesByName = new Map(opts.registerTarget === false ? [] : [["users", target]]);
    return {
      config: {
        adapter,
        resourcesByName,
        ...(opts.globalScope ? { scope: () => ({ tenantId: "t1" }) } : {}),
      } as unknown as ResolvedAdminConfig,
      list,
    };
  }

  it("resolves ONLY the current value by primary key — never a preloaded page of options", async () => {
    const { config: cfg, list } = configWith({});
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([{ value: "u42", label: "owner@x.com" }]);
    expect(list).toHaveBeenCalledTimes(1);
    const listCtx = list.mock.calls[0]?.[1] as {
      filters: Record<string, unknown>;
      pageSize: number;
    };
    expect(listCtx.filters).toEqual({ id: "u42" });
    expect(listCtx.pageSize).toBe(1);
  });

  it("returns no options on a create form (no current value) without querying at all", async () => {
    const { config: cfg, list } = configWith({});
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"));
    expect(resolved[0]?.options).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns no options when the referenced row no longer exists", async () => {
    const { config: cfg } = configWith({ rows: [] });
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
  });

  it("returns no options when the target resource isn't registered", async () => {
    const { config: cfg } = configWith({ registerTarget: false });
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
  });

  it("returns no options when the viewer's role can't read the target resource", async () => {
    const { config: cfg, list } = configWith({ requireRole: "superadmin" });
    const resolved = await resolveFormFields(cfg, fields, ctx("staff"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns no options when global scope is active and the target declares no scope", async () => {
    const { config: cfg, list } = configWith({ globalScope: true });
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("binds the target's scope predicate to the request's scope value", async () => {
    const scopeCalls: unknown[][] = [];
    const { config: cfg, list } = configWith({
      globalScope: true,
      targetScope: (scope: unknown, query: unknown) => {
        scopeCalls.push([scope, query]);
        return query;
      },
    });
    const scoped = { ...ctx("admin"), scope: { tenantId: "t1" } } as RequestContext;
    await resolveFormFields(cfg, fields, scoped, { ownerId: "u42" });
    const listCtx = list.mock.calls[0]?.[1] as {
      applyScope?: (q: unknown) => unknown;
      scopeRequired?: boolean;
    };
    expect(listCtx.scopeRequired).toBe(true);
    listCtx.applyScope?.("q");
    expect(scopeCalls).toEqual([[{ tenantId: "t1" }, "q"]]);
  });

  it("includes the label when the viewer's role satisfies the target's requireRole", async () => {
    const { config: cfg } = configWith({ requireRole: "staff" });
    const resolved = await resolveFormFields(cfg, fields, ctx("staff"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([{ value: "u42", label: "owner@x.com" }]);
  });
});
