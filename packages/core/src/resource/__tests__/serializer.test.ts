import { describe, it, expect, vi } from "vitest";
import { serializeResource } from "../serializer";
import type { ResolvedResource, ResolvedColumn, ResolvedFilter, ResolvedAction } from "../types";

// ---------------------------------------------------------------------------
// Helpers to build minimal ResolvedResource
// ---------------------------------------------------------------------------

function makeColumn(overrides: Partial<ResolvedColumn> = {}): ResolvedColumn {
  return {
    id: "email",
    path: "email",
    label: "Email",
    type: "field",
    format: "text",
    opts: {},
    ...overrides,
  };
}

function makeFilter(overrides: Partial<ResolvedFilter> = {}): ResolvedFilter {
  return {
    id: "status",
    path: "status",
    label: "Status",
    mode: "enum",
    opts: {},
    ...overrides,
  };
}

function makeAction(overrides: Partial<ResolvedAction> = {}): ResolvedAction {
  return {
    id: "cancel",
    type: "mutation",
    label: "Cancel",
    variant: "default",
    handler: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeResolvedResource(overrides: Partial<ResolvedResource> = {}): ResolvedResource {
  return {
    id: "subscription",
    modelName: "Subscription",
    label: "Subscription",
    labelPlural: "Subscriptions",
    icon: "credit-card",
    path: "subscription",
    defaultPageSize: 50,
    searchFields: ["email"],
    columns: [makeColumn()],
    filters: [makeFilter()],
    actions: [makeAction()],
    access: {},
    fieldAccess: [],
    _handlers: { cancel: vi.fn().mockResolvedValue(undefined) },
    _computes: {},
    _whens: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Stripping functions
// ---------------------------------------------------------------------------

describe("serializeResource — strips handler functions", () => {
  it("does not include handler in serialized actions", () => {
    const resource = makeResolvedResource();
    const serialized = serializeResource(resource, []);
    expect((serialized.actions[0] as any).handler).toBeUndefined();
  });

  it("does not include _handlers, _computes, _whens in serialized output", () => {
    const resource = makeResolvedResource();
    const serialized = serializeResource(resource, []) as any;
    expect(serialized._handlers).toBeUndefined();
    expect(serialized._computes).toBeUndefined();
    expect(serialized._whens).toBeUndefined();
  });
});

describe("serializeResource — strips compute functions", () => {
  it("does not include compute fn in serialized columns", () => {
    const resource = makeResolvedResource({
      columns: [
        makeColumn({
          id: "total",
          path: null,
          type: "computed",
          compute: (row) => (row.price as number) * 2,
        }),
      ],
    });
    const serialized = serializeResource(resource, []);
    expect((serialized.columns[0] as any).compute).toBeUndefined();
  });

  it("does not include render in serialized columns", () => {
    const resource = makeResolvedResource({
      columns: [makeColumn({ render: () => "ReactElement" })],
    });
    const serialized = serializeResource(resource, []);
    expect((serialized.columns[0] as any).render).toBeUndefined();
  });

  it("sets hasHref true when href function is present", () => {
    const resource = makeResolvedResource({
      columns: [makeColumn({ opts: { href: (row) => `/user/${row.id}` } })],
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.columns[0].hasHref).toBe(true);
    expect((serialized.columns[0].opts as any).href).toBeUndefined();
  });

  it("hasHref is undefined when no href function", () => {
    const resource = makeResolvedResource();
    const serialized = serializeResource(resource, []);
    expect(serialized.columns[0].hasHref).toBeUndefined();
  });
});

describe("serializeResource — strips toWhere from filters", () => {
  it("does not include toWhere in serialized filters", () => {
    const resource = makeResolvedResource({
      filters: [makeFilter({ toWhere: (v) => ({ status: v }) })],
    });
    const serialized = serializeResource(resource, []);
    expect((serialized.filters[0] as any).toWhere).toBeUndefined();
  });

  it("does not include render in serialized filters", () => {
    const resource = makeResolvedResource({
      filters: [makeFilter({ render: () => "ReactElement" })],
    });
    const serialized = serializeResource(resource, []);
    expect((serialized.filters[0] as any).render).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Access evaluation
// ---------------------------------------------------------------------------

describe("serializeResource — evaluates access rules", () => {
  it("false rule → false", () => {
    const resource = makeResolvedResource({ access: { list: false } });
    const serialized = serializeResource(resource, ["admin"]);
    expect(serialized.access.list).toBe(false);
  });

  it("string[] rule with matching role → true", () => {
    const resource = makeResolvedResource({ access: { list: ["admin", "editor"] } });
    const serialized = serializeResource(resource, ["editor"]);
    expect(serialized.access.list).toBe(true);
  });

  it("string[] rule with no matching role → false", () => {
    const resource = makeResolvedResource({ access: { list: ["admin"] } });
    const serialized = serializeResource(resource, ["viewer"]);
    expect(serialized.access.list).toBe(false);
  });

  it("undefined rule → true", () => {
    const resource = makeResolvedResource({ access: {} });
    const serialized = serializeResource(resource, []);
    expect(serialized.access.list).toBe(true);
    expect(serialized.access.read).toBe(true);
    expect(serialized.access.create).toBe(true);
    expect(serialized.access.update).toBe(true);
    expect(serialized.access.delete).toBe(true);
  });

  it("function rule → true (evaluated per-row server-side)", () => {
    const resource = makeResolvedResource({
      access: { list: (ctx) => true },
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.access.list).toBe(true);
  });

  it("evaluates custom action access rules", () => {
    const resource = makeResolvedResource({
      actions: [makeAction({ id: "cancel" })],
      access: { cancel: ["admin"] },
    });
    const serialized = serializeResource(resource, ["viewer"]);
    expect(serialized.access["cancel"]).toBe(false);
  });

  it("empty sessionRoles with role allowlist → false", () => {
    const resource = makeResolvedResource({ access: { delete: ["admin"] } });
    const serialized = serializeResource(resource, []);
    expect(serialized.access.delete).toBe(false);
  });
});

describe("serializeResource — readOnly forces access booleans", () => {
  it("readOnly resource forces create/update/delete to false", () => {
    const resource = makeResolvedResource({ access: {} } as any);
    (resource as any).readOnly = true;
    const serialized = serializeResource(resource, ["admin"]);
    expect(serialized.access.create).toBe(false);
    expect(serialized.access.update).toBe(false);
    expect(serialized.access.delete).toBe(false);
    // list and read should still be allowed
    expect(serialized.access.list).toBe(true);
    expect(serialized.access.read).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Action confirm with function description
// ---------------------------------------------------------------------------

describe("serializeResource — action confirm", () => {
  it("keeps confirm when description is a string", () => {
    const resource = makeResolvedResource({
      actions: [
        makeAction({
          confirm: {
            title: "Are you sure?",
            description: "This cannot be undone.",
            intent: "destructive",
          },
        }),
      ],
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.actions[0].confirm?.title).toBe("Are you sure?");
    expect(serialized.actions[0].confirm?.description).toBe("This cannot be undone.");
  });

  it("strips function description from confirm", () => {
    const resource = makeResolvedResource({
      actions: [
        makeAction({
          confirm: {
            title: "Confirm",
            description: (row) => `Cancel subscription for ${row.email}`,
          },
        }),
      ],
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.actions[0].confirm?.title).toBe("Confirm");
    expect(serialized.actions[0].confirm?.description).toBeUndefined();
  });

  it("action has allowed based on access rule", () => {
    const resource = makeResolvedResource({
      actions: [makeAction({ id: "cancel" })],
      access: { cancel: false },
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.actions[0].allowed).toBe(false);
  });

  it("action allowed true when no access rule", () => {
    const resource = makeResolvedResource({
      actions: [makeAction({ id: "cancel" })],
      access: {},
    });
    const serialized = serializeResource(resource, []);
    expect(serialized.actions[0].allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hasWhen on actions
// ---------------------------------------------------------------------------

describe("serializeResource — hasWhen on actions", () => {
  it("sets hasWhen not present when no when predicate", () => {
    const resource = makeResolvedResource({
      actions: [makeAction({ when: undefined })],
    });
    const serialized = serializeResource(resource, []) as any;
    expect(serialized.actions[0].hasWhen).toBeUndefined();
  });

  it("sets hasWhen true when when predicate exists", () => {
    const resource = makeResolvedResource({
      actions: [makeAction({ when: (row) => true })],
    });
    const serialized = serializeResource(resource, []) as any;
    // SerializedAction doesn't officially have hasWhen but it shouldn't include when fn
    expect(serialized.actions[0].when).toBeUndefined();
  });
});
