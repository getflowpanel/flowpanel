import type {
  Adapter,
  FieldDef,
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
    getResult?: Record<string, unknown> | null;
    requireRole?: string;
    registerTarget?: boolean;
  }) {
    const get = vi.fn(async () =>
      opts.getResult === undefined ? { id: "u42", email: "owner@x.com" } : opts.getResult,
    );
    const list = vi.fn(async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }));
    const adapter = {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
      get,
      list,
    } as unknown as Adapter;
    const target: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: { columns: [], ...(opts.requireRole ? { requireRole: opts.requireRole } : {}) },
    } as never;
    const resourcesByName = new Map(opts.registerTarget === false ? [] : [["users", target]]);
    return {
      config: { adapter, resourcesByName } as unknown as ResolvedAdminConfig,
      get,
      list,
    };
  }

  it("resolves ONLY the current value's label via adapter.get — never adapter.list", async () => {
    const { config: cfg, get, list } = configWith({});
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([{ value: "u42", label: "owner@x.com" }]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns no options on a create form (no current value) without calling adapter.get", async () => {
    const { config: cfg, get } = configWith({});
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"));
    expect(resolved[0]?.options).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("returns no options when the referenced row no longer exists", async () => {
    const { config: cfg } = configWith({ getResult: null });
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
  });

  it("returns no options when the target resource isn't registered", async () => {
    const { config: cfg } = configWith({ registerTarget: false });
    const resolved = await resolveFormFields(cfg, fields, ctx("admin"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
  });

  it("returns no options when the viewer's role can't read the target resource", async () => {
    const { config: cfg, get } = configWith({ requireRole: "superadmin" });
    const resolved = await resolveFormFields(cfg, fields, ctx("staff"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("includes the label when the viewer's role satisfies the target's requireRole", async () => {
    const { config: cfg } = configWith({ requireRole: "staff" });
    const resolved = await resolveFormFields(cfg, fields, ctx("staff"), { ownerId: "u42" });
    expect(resolved[0]?.options).toEqual([{ value: "u42", label: "owner@x.com" }]);
  });
});
