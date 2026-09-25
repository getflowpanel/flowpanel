import type {
  Adapter,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetConfig,
} from "@flowpanel/core";
import { metric, table } from "@flowpanel/core";
import { describe, expect, it, vi } from "vitest";
import { serializeWidget } from "../drawer/serialize-widget";
import { bindViewedRecord } from "../runtime/record-scope";
import { fakeWidgetContext } from "./widget-context-fixture";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({}) as never,
  list: async () => ({
    rows: [
      { id: "p1", userId: "u1", amount: 10 },
      { id: "p2", userId: "u1", amount: 20 },
    ],
    total: 2,
    page: 1,
    pageSize: 20,
  }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function mkConfig(extraResources: ResourceConfig[] = []): ResolvedAdminConfig {
  const resources = [...extraResources];
  const byName = new Map<string, ResourceConfig>();
  for (const r of resources) {
    const name = (r.ref as { __name?: string }).__name ?? "?";
    byName.set(name, r);
  }
  return {
    adapter: fakeAdapter,
    auth: { session: async () => null, role: () => "admin" },
    resources,
    resourcesByName: byName,
    dashboardsByPath: new Map(),
    __resolved: true,
  } as never;
}

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};
const widgetCtx = fakeWidgetContext();

describe("serializeWidget — metric", () => {
  it("invokes query and returns wire-safe metric payload", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Total users",
      query: async () => 42,
      options: { format: "number", sublabel: "all time", tone: "positive", span: 2 },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toEqual({
      kind: "metric",
      label: "Total users",
      value: 42,
      format: "number",
      sublabel: "all time",
      tone: "positive",
      span: 2,
    });
  });

  it("propagates realtime channel through the serialized payload", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 7,
      options: { realtime: "resource.orders" },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({ kind: "metric", realtime: "resource.orders" });
  });

  it("propagates realtime array through the serialized payload", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Active",
      query: async () => 3,
      options: { realtime: ["resource.a", "resource.b"] },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({ kind: "metric", realtime: ["resource.a", "resource.b"] });
  });
});

describe("serializeWidget — table", () => {
  it("uses user-defined query() and derives columns from row keys when not specified", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: {
        query: async () => [{ a: 1, b: 2 }],
      },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({
      kind: "table",
      rows: [{ a: 1, b: 2 }],
      columns: [{ field: "a" }, { field: "b" }],
    });
  });

  it("resource-backed table pulls columns from resource.options.columns with humanized labels", async () => {
    const target: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "payments" },
      options: {
        columns: [
          "id",
          { field: "userId", label: "User" },
          { field: "amount" },
          { field: "secret", hidden: true },
          { label: "no-field" }, // skipped: missing field
        ],
      },
    } as never;
    const widget: WidgetConfig = {
      kind: "table",
      options: { resource: "payments", limit: 5, label: "Payments", span: 3 },
    } as never;
    const out = await serializeWidget(widget, mkConfig([target]), reqCtx, widgetCtx);
    expect(out).toMatchObject({
      kind: "table",
      label: "Payments",
      span: 3,
      columns: [{ field: "id" }, { field: "userId", label: "User" }, { field: "amount" }],
    });
    expect((out as { rows: unknown[] }).rows).toHaveLength(2);
  });

  it("returns empty rows/columns when widget.options.resource is unknown", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: { resource: "ghost" },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({ kind: "table", rows: [], columns: [] });
  });

  it("widget.options.columns override resource columns", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: {
        query: async () => [{ a: 1, b: 2 }],
        columns: ["b"],
      },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect((out as { columns: unknown[] }).columns).toEqual([{ field: "b" }]);
  });

  it("threads softDelete column through to adapter.list", async () => {
    let captured: unknown = null;
    const customAdapter: Adapter = {
      ...fakeAdapter,
      list: async (_ref, ctx) => {
        captured = (ctx as { softDelete?: unknown }).softDelete;
        return { rows: [], total: 0, page: 1, pageSize: 10 };
      },
    };
    const target: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "payments" },
      options: {
        columns: ["id"],
        delete: { softDelete: "deletedAt" as never },
      },
    } as never;
    const cfg = {
      ...mkConfig([target]),
      adapter: customAdapter,
    } as ResolvedAdminConfig;
    const widget: WidgetConfig = {
      kind: "table",
      options: { resource: "payments" },
    } as never;
    await serializeWidget(widget, cfg, reqCtx, widgetCtx);
    expect(captured).toEqual({ column: "deletedAt" });
  });
});

describe("serializeWidget — statGroup", () => {
  it("invokes function values, passes through literals, includes format/tone", async () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: {
        label: "KPIs",
        span: 4,
        stats: [
          { label: "fn", value: async () => 100, format: "percent", tone: "positive" },
          { label: "lit", value: "hello" },
        ],
      },
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({
      kind: "statGroup",
      label: "KPIs",
      span: 4,
      stats: [
        { label: "fn", value: 100, format: "percent", tone: "positive" },
        { label: "lit", value: "hello" },
      ],
    });
  });
});

describe("serializeWidget — chart variants", () => {
  it.each([
    ["areaChart", "area"],
    ["barChart", "bar"],
    ["lineChart", "line"],
    ["pieChart", "pie"],
  ])("maps %s → subkind=%s and counts dataPoints", async (kind, subkind) => {
    const widget = {
      kind,
      label: `${subkind} chart`,
      query: async () => [1, 2, 3, 4],
      options: { span: 6 },
    } as unknown as WidgetConfig;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({
      kind: "chart",
      subkind,
      label: `${subkind} chart`,
      dataPoints: 4,
      span: 6,
    });
  });
});

describe("serializeWidget — error & unknown", () => {
  it("names the kind a drawer cannot render yet", async () => {
    const out = await serializeWidget(
      { kind: "custom", Component: () => null, props: {}, options: {} } as never,
      mkConfig(),
      reqCtx,
      widgetCtx,
    );
    expect(out).toEqual({
      kind: "unsupported",
      reason: "custom widgets are not supported in drawers yet",
    });
  });

  it("returns unsupported on unknown widget kind", async () => {
    const widget = { kind: "weirdo", options: {} } as unknown as WidgetConfig;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toMatchObject({ kind: "unsupported" });
  });

  it("catches query() errors without leaking the raw message to the browser", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Boom",
      query: async () => {
        throw new Error("db down: postgres://user:pw@host/db");
      },
      options: {},
    } as never;
    const out = await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx);
    expect(out).toEqual({ kind: "unsupported", reason: "widget query failed", failed: true });
  });
});

describe("serializeWidget — cross-resource authorization", () => {
  const widget: WidgetConfig = {
    kind: "table",
    options: { resource: "payments" },
  } as never;

  function targetWith(options: Record<string, unknown>): ResourceConfig {
    return {
      __kind: "resource",
      ref: { __name: "payments" },
      options: { columns: ["id", "userId", "amount"], ...options },
    } as never;
  }

  it("does not read a role-gated target the viewer cannot access", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }));
    const cfg = {
      ...mkConfig([targetWith({ requireRole: "superadmin" })]),
      adapter: { ...fakeAdapter, list },
    } as ResolvedAdminConfig;
    const out = await serializeWidget(widget, cfg, { ...reqCtx, role: "staff" }, widgetCtx);
    expect(out).toMatchObject({ kind: "table", rows: [], columns: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("does not read a target that declares no scope while global scope is active", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }));
    const cfg = {
      ...mkConfig([targetWith({})]),
      adapter: { ...fakeAdapter, list },
      scope: () => ({ tenantId: "t1" }),
    } as unknown as ResolvedAdminConfig;
    const out = await serializeWidget(widget, cfg, reqCtx, widgetCtx);
    expect(out).toMatchObject({ kind: "table", rows: [], columns: [] });
    expect(list).not.toHaveBeenCalled();
  });

  it("binds the target's scope predicate to the request's scope value", async () => {
    const scopePredicate = vi.fn((scope: unknown, query: unknown) => ({ scope, query }));
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
    }));
    const cfg = {
      ...mkConfig([targetWith({ scope: scopePredicate })]),
      adapter: { ...fakeAdapter, list },
      scope: () => ({ tenantId: "t1" }),
    } as unknown as ResolvedAdminConfig;
    await serializeWidget(widget, cfg, { ...reqCtx, scope: { tenantId: "t1" } }, widgetCtx);
    const listCtx = list.mock.calls[0]?.[1] as {
      applyScope?: (q: unknown) => unknown;
      scopeRequired?: boolean;
    };
    expect(listCtx.scopeRequired).toBe(true);
    listCtx.applyScope?.("q");
    expect(scopePredicate).toHaveBeenCalledWith({ tenantId: "t1" }, "q");
  });

  it("ships only the target's declared fields — an undeclared column never reaches the wire", async () => {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [{ id: "p1", userId: "u1", amount: 10, internalNote: "fraud review" }],
      total: 1,
      page: 1,
      pageSize: 10,
    }));
    const cfg = {
      ...mkConfig([targetWith({})]),
      adapter: { ...fakeAdapter, list },
    } as ResolvedAdminConfig;
    const out = await serializeWidget(widget, cfg, reqCtx, widgetCtx);
    expect((out as { rows: Record<string, unknown>[] }).rows).toEqual([
      { id: "p1", userId: "u1", amount: 10 },
    ]);
  });
});

describe("serializeWidget — a failed widget and a Date", () => {
  it("marks a widget whose query threw, so the drawer can flag it as an error", async () => {
    const out = await serializeWidget(
      {
        kind: "stat",
        label: "Open",
        value: async () => {
          throw new Error("db down");
        },
        options: {},
      } as never,
      mkConfig(),
      reqCtx,
      widgetCtx,
    );
    expect(out).toMatchObject({ kind: "unsupported", failed: true });
  });

  it("sends a statGroup Date over the wire already formatted in the admin's zone", async () => {
    const cfg = { ...mkConfig(), formatting: { timeZone: "Asia/Bangkok" } } as ResolvedAdminConfig;
    const out = await serializeWidget(
      {
        kind: "statGroup",
        options: {
          stats: [{ label: "Joined", value: async () => new Date("2026-09-22T23:30:00Z") }],
        },
      } as never,
      cfg,
      reqCtx,
      widgetCtx,
    );
    expect((out as { stats: { value: unknown }[] }).stats[0]?.value).toBe("2026-09-23 06:30");
  });
});

describe("serializeWidget — table column formats", () => {
  it("carries a query table's column labels and formats to the drawer", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: {
        query: async () => [{ stage: "score", p95: 7_500_000 }],
        columns: ["stage", { field: "p95", label: "p95", format: "duration" }],
      },
    };
    expect(await serializeWidget(widget, mkConfig(), reqCtx, widgetCtx)).toMatchObject({
      kind: "table",
      columns: [{ field: "stage" }, { field: "p95", label: "p95", format: "duration" }],
    });
  });
});

describe("serializeWidget — a drawer over a record", () => {
  const responses: ResourceConfig = {
    __kind: "resource",
    ref: { __name: "responses" },
    options: {
      columns: ["id", { field: "userId", reference: { resource: "users", labelField: "id" } }],
    },
  } as never;

  it("narrows a resource table by its where", async () => {
    let filters: unknown = null;
    const adapter: Adapter = {
      ...fakeAdapter,
      list: async (_ref, ctx) => {
        filters = (ctx as { filters?: unknown }).filters;
        return { rows: [], total: 0, page: 1, pageSize: 10 };
      },
    };
    const cfg = { ...mkConfig([responses]), adapter } as ResolvedAdminConfig;
    const widget = table({ resource: "responses", where: (c) => ({ userId: c.id }) });
    await serializeWidget(widget, cfg, reqCtx, fakeWidgetContext({ id: "u1" }));
    expect(filters).toMatchObject({ userId: "u1" });
  });

  it("counts only the record's rows in a count metric", async () => {
    const counted: unknown[] = [];
    const ctx = fakeWidgetContext({
      count: async (_resource, where) => {
        counted.push(where);
        return 2;
      },
    });
    bindViewedRecord(ctx, "users", "u1");
    const out = await serializeWidget(
      metric("Responses", { count: "responses" }),
      mkConfig([responses]),
      reqCtx,
      ctx,
    );
    expect(counted).toEqual([{ userId: "u1" }]);
    expect(out).toMatchObject({ kind: "metric", value: 2 });
  });
});
