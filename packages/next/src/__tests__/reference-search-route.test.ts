import type { Adapter, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { referenceSearchRoute } from "../actions/reference-search.js";

interface FixtureOpts {
  role?: string;
  sourceRequireRole?: string;
  targetRequireRole?: string;
  fieldRequireRole?: string;
  registerTarget?: boolean;
  /** All rows a real DB would hold — `list` filters by `ctx.search` server-side. */
  targetRows?: { id: string; email: string }[];
  scopeCapture?: { applyScope?: unknown; scopeRequired?: unknown }[];
  searchFieldsCapture?: (string[] | undefined)[];
  listThrows?: boolean;
}

function makeConfig(opts: FixtureOpts) {
  const targetRows =
    opts.targetRows ??
    Array.from({ length: 5000 }, (_, i) => ({ id: `u${i}`, email: `u${i}@x.com` }));

  const list = vi.fn(async (_ref: unknown, listCtx: Record<string, unknown>) => {
    opts.scopeCapture?.push({
      applyScope: listCtx.applyScope,
      scopeRequired: listCtx.scopeRequired,
    });
    opts.searchFieldsCapture?.push(listCtx.searchFields as string[] | undefined);
    if (opts.listThrows) throw new Error("db exploded");
    const search = String(listCtx.search ?? "");
    const pageSize = Number(listCtx.pageSize ?? 20);
    const rows = search
      ? targetRows.filter((r) => r.email.toLowerCase().includes(search.toLowerCase()))
      : targetRows;
    return { rows: rows.slice(0, pageSize), total: rows.length, page: 1, pageSize };
  });

  const adapter = {
    kind: "drizzle",
    db: {},
    introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
    list,
  } as unknown as Adapter;

  const source: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "orders" },
    options: {
      columns: [],
      ...(opts.sourceRequireRole ? { requireRole: opts.sourceRequireRole } : {}),
      create: {
        fields: [
          {
            name: "ownerId",
            type: "reference",
            reference: { resource: "users", labelField: "email" },
            ...(opts.fieldRequireRole ? { requireRole: opts.fieldRequireRole } : {}),
          },
          { name: "title" },
        ],
      },
    },
  } as never;

  const target: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "users" },
    options: {
      columns: [],
      ...(opts.targetRequireRole ? { requireRole: opts.targetRequireRole } : {}),
    },
  } as never;

  const resourcesByName = new Map<string, ResourceConfig>([["orders", source]]);
  if (opts.registerTarget !== false) resourcesByName.set("users", target);

  const config: ResolvedAdminConfig = {
    adapter,
    auth: {
      session: async () => null,
      role: () => opts.role ?? "admin",
    },
    resources: [source, target],
    resourcesByName,
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;

  return { config, list };
}

/** Turn on admin-wide scope and set each resource's own `scope` declaration. */
function withGlobalScope(
  config: ResolvedAdminConfig,
  scopes: { source?: unknown; target?: unknown },
): void {
  (config as { scope?: unknown }).scope = () => ({ tenantId: "t1" });
  const source = config.resourcesByName.get("orders") as ResourceConfig;
  (source.options as { scope?: unknown }).scope = scopes.source;
  const target = config.resourcesByName.get("users");
  if (target) (target.options as { scope?: unknown }).scope = scopes.target;
}

function paramsFor(resource: string, field: string) {
  return Promise.resolve({ resource, field });
}

function reqFor(resource: string, field: string, q?: string) {
  const url = new URL(`http://localhost/api/flowpanel/${resource}/reference/${field}`);
  if (q !== undefined) url.searchParams.set("q", q);
  return new Request(url);
}

describe("referenceSearchRoute", () => {
  it("returns 404 when the resource name is unknown", async () => {
    const handler = referenceSearchRoute(makeConfig({}).config);
    const res = await handler(reqFor("ghost", "ownerId"), {
      params: paramsFor("ghost", "ownerId"),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the field isn't a declared reference field", async () => {
    const handler = referenceSearchRoute(makeConfig({}).config);
    const res = await handler(reqFor("orders", "title"), { params: paramsFor("orders", "title") });
    expect(res.status).toBe(404);
  });

  it("enforces resource-level authorization: 403 when the session lacks the source resource's role", async () => {
    const { config } = makeConfig({ role: "staff", sourceRequireRole: "admin" });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(403);
  });

  it("enforces field-level authorization: 403 when the session lacks the reference field's role", async () => {
    const { config } = makeConfig({ role: "staff", fieldRequireRole: "admin" });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(403);
  });

  it("answers 403 — never ok:true — when the session lacks the TARGET resource's role", async () => {
    const { config, list } = makeConfig({ role: "staff", targetRequireRole: "admin" });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(list).not.toHaveBeenCalled();
  });

  it("answers 403 when global scope is active and the target declares no scope", async () => {
    const { config, list } = makeConfig({});
    withGlobalScope(config, { source: "bypass" });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(403);
    expect(list).not.toHaveBeenCalled();
  });

  it("returns matches beyond the first 100 rows of the target resource", async () => {
    const { config } = makeConfig({});
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId", "u4999@"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { options: { value: string; label: string }[] };
    expect(body.options).toEqual([{ value: "u4999", label: "u4999@x.com" }]);
  });

  it("binds search to the field's declared labelField only", async () => {
    const searchFieldsCapture: (string[] | undefined)[] = [];
    const { config } = makeConfig({ searchFieldsCapture });
    const handler = referenceSearchRoute(config);
    await handler(reqFor("orders", "ownerId", "x"), { params: paramsFor("orders", "ownerId") });
    expect(searchFieldsCapture).toEqual([["email"]]);
  });

  it("respects tenant scope: binds the target resource's scope predicate onto the list query", async () => {
    const scopeCapture: { applyScope?: unknown; scopeRequired?: unknown }[] = [];
    const { config } = makeConfig({ scopeCapture });
    // No `config.scope` configured here — `scopeBinding` still runs and this
    // asserts the route always threads its result through, so a resource
    // that DOES declare a function scope gets it applied identically to a
    // normal list query (same `scopeBinding` helper, same call site shape).
    const handler = referenceSearchRoute(config);
    await handler(reqFor("orders", "ownerId", ""), { params: paramsFor("orders", "ownerId") });
    expect(scopeCapture).toHaveLength(1);
    expect(scopeCapture[0]?.scopeRequired).toBe(false);
  });

  it("returns an initial page (no query) for a fresh picker open", async () => {
    const { config } = makeConfig({ targetRows: [{ id: "u1", email: "a@x.com" }] });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId", ""), {
      params: paramsFor("orders", "ownerId"),
    });
    const body = (await res.json()) as { options: unknown[] };
    expect(body.options).toEqual([{ value: "u1", label: "a@x.com" }]);
  });

  it("returns 500 with a generic message (not the raw adapter error) when list throws", async () => {
    const { config } = makeConfig({ listThrows: true });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId", "x"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toMatch(/db exploded/);
  });

  it("answers 404 — never ok:true — when the target resource isn't registered", async () => {
    const { config } = makeConfig({ registerTarget: false });
    const handler = referenceSearchRoute(config);
    const res = await handler(reqFor("orders", "ownerId", "x"), {
      params: paramsFor("orders", "ownerId"),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it("binds the target's scope predicate to the request's scope value", async () => {
    const scopeCapture: { applyScope?: unknown; scopeRequired?: unknown }[] = [];
    const scopePredicate = vi.fn((scope: unknown, query: unknown) => ({ scope, query }));
    const { config } = makeConfig({ scopeCapture });
    withGlobalScope(config, { source: "bypass", target: scopePredicate });
    const handler = referenceSearchRoute(config);
    await handler(reqFor("orders", "ownerId", ""), { params: paramsFor("orders", "ownerId") });
    expect(scopeCapture[0]?.scopeRequired).toBe(true);
    (scopeCapture[0]?.applyScope as (q: unknown) => unknown)("q");
    expect(scopePredicate).toHaveBeenCalledWith({ tenantId: "t1" }, "q");
  });
});
