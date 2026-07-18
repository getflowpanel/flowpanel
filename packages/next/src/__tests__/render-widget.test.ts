import type {
  Adapter,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { MetricCard, RealtimeRefresh, TableWidget } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ServerCard } from "../runtime/_server-card.js";
import { renderWidget } from "../runtime/render-widget.js";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({}) as never,
  list: async () => ({
    rows: [{ id: "1", name: "a" }],
    total: 1,
    page: 1,
    pageSize: 10,
  }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const cfg: ResolvedAdminConfig = {
  adapter: fakeAdapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [],
  resourcesByName: new Map(),
  dashboardsByPath: new Map(),
  __resolved: true,
} as never;

const ctx: WidgetContext = {
  db: {},
  session: null,
  dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
  req: new Request("http://localhost/"),
};

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

/**
 * Walks the rendered ReactNode tree (which renderWidget returns as a
 * fragment) and finds the first `<RealtimeRefresh>` element OR the
 * `<TableWidget realtime=...>` prop. Returns the channels value, or
 * undefined if no subscriber is present.
 */
function findRealtimeChannels(tree: ReactNode): unknown {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findRealtimeChannels(child);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<{
    channels?: unknown;
    realtime?: unknown;
    children?: ReactNode;
  }>;
  if (el.type === RealtimeRefresh) return el.props.channels;
  if (el.type === TableWidget && el.props.realtime !== undefined) return el.props.realtime;
  return findRealtimeChannels(el.props.children);
}

/**
 * Walks a rendered tree and returns the props of the first element whose
 * `type` matches `target`, or `undefined` if none is found. Shared across
 * the describe blocks below (unlike the near-identical helpers scoped
 * inside individual `describe` callbacks further down this file).
 */
function findElementByType(tree: ReactNode, target: unknown): Record<string, unknown> | undefined {
  if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const c of tree) {
      const found = findElementByType(c, target);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(tree)) return undefined;
  const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (el.type === target) return el.props;
  return findElementByType(el.props.children, target);
}

describe("renderWidget — metric icon", () => {
  it("passes options.icon through to MetricCard", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: { icon: "📦" },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    const props = findElementByType(node, MetricCard);
    expect(props?.icon).toBe("📦");
  });

  it("omits the icon prop when options.icon is unset", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    const props = findElementByType(node, MetricCard);
    expect(props?.icon).toBeUndefined();
  });
});

describe("renderWidget — table emptyState", () => {
  it("passes options.emptyState through to TableWidget", async () => {
    const empty = "No orders yet" as unknown as ReactNode;
    const widget: WidgetConfig = {
      kind: "table",
      options: { query: async () => [], emptyState: empty },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(isValidElement(node)).toBe(true);
    const el = node as ReactElement<{ emptyState?: ReactNode }>;
    expect(el.props.emptyState).toBe(empty);
  });

  it("omits emptyState when unset", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: { query: async () => [] },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    const el = node as ReactElement<{ emptyState?: ReactNode }>;
    expect(el.props.emptyState).toBeUndefined();
  });
});

describe("renderWidget — realtime wiring", () => {
  it("metric widget mounts a RealtimeRefresh subscriber when options.realtime is set", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: { realtime: "resource.orders" },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(findRealtimeChannels(node)).toBe("resource.orders");
  });

  it("metric widget omits the subscriber when options.realtime is undefined", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(findRealtimeChannels(node)).toBeUndefined();
  });

  it("table widget forwards realtime through to TableWidget", async () => {
    const widget: WidgetConfig = {
      kind: "table",
      options: {
        query: async () => [{ id: "1", a: 1 }],
        realtime: "resource.users",
      },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(findRealtimeChannels(node)).toBe("resource.users");
  });

  it("custom widget mounts a RealtimeRefresh subscriber when options.realtime is set", async () => {
    const Comp = () => null;
    const widget: WidgetConfig = {
      kind: "custom",
      Component: Comp,
      props: {},
      options: { realtime: ["resource.a", "resource.b"] },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(findRealtimeChannels(node)).toEqual(["resource.a", "resource.b"]);
  });

  it("statGroup widget mounts a RealtimeRefresh subscriber when options.realtime is set", async () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: { stats: [{ label: "x", value: 1 }], realtime: "resource.kpi" },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);
    expect(findRealtimeChannels(node)).toBe("resource.kpi");
  });
});

describe("renderWidget — custom widgets server-render", () => {
  /**
   * Walks the rendered tree and returns true if any element has `type === target`.
   * Used to assert that the user's Component appears as an *element* (good)
   * — separate from whether it appears as a `Component` *prop* (bad).
   */
  function treeHasType(tree: ReactNode, target: unknown): boolean {
    if (tree === null || tree === undefined || typeof tree !== "object") return false;
    if (Array.isArray(tree)) return tree.some((c) => treeHasType(c, target));
    if (!isValidElement(tree)) return false;
    const el = tree as ReactElement<{ children?: ReactNode }>;
    if (el.type === target) return true;
    return treeHasType(el.props.children, target);
  }

  /**
   * Walks the tree looking for the first rendered element of the given `type`.
   * Returns the props of that element, or undefined if none is found.
   */
  function findElement(
    tree: ReactNode,
    type: unknown,
  ): { children?: ReactNode; [k: string]: unknown } | undefined {
    if (tree === null || tree === undefined || typeof tree !== "object") return undefined;
    if (Array.isArray(tree)) {
      for (const c of tree) {
        const found = findElement(c, type);
        if (found) return found;
      }
      return undefined;
    }
    if (!isValidElement(tree)) return undefined;
    const el = tree as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
    if (el.type === type) return el.props;
    return findElement(el.props.children, type);
  }

  it("custom widget wraps the Component element in a ServerCard (not @flowpanel/react's CustomWidget)", async () => {
    const Comp = () => null;
    const widget: WidgetConfig = {
      kind: "custom",
      Component: Comp,
      props: { n: 42 },
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);

    // The user's Component element must appear directly as a child of the
    // ServerCard — NOT routed through any wrapper that takes it as a prop
    // (which would re-introduce the RSC function-boundary bug).
    const card = findElement(node, ServerCard);
    expect(card).toBeDefined();
    expect(treeHasType(node, Comp)).toBe(true);
  });

  it("custom widget resolves async props before constructing the Component element", async () => {
    const Comp = (_p: { label: string }) => null;
    const widget: WidgetConfig = {
      kind: "custom",
      Component: Comp,
      props: async () => ({ label: "hello" }),
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);

    // Locate the Component element and assert the resolved props landed
    // on it (not the resolver function itself).
    const found = findElement(node, Comp) as { label?: unknown } | undefined;
    expect(found).toBeDefined();
    expect(found?.label).toBe("hello");
  });

  it("custom widget skips the ServerCard wrapper when options.frame === false", async () => {
    const Comp = () => null;
    const widget: WidgetConfig = {
      kind: "custom",
      Component: Comp,
      props: {},
      options: { frame: false },
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);

    // No ServerCard in the tree — the user's Component appears as a direct
    // child of the returned Fragment.
    function hasServerCard(tree: ReactNode): boolean {
      if (tree === null || tree === undefined || typeof tree !== "object") return false;
      if (Array.isArray(tree)) return tree.some(hasServerCard);
      if (!isValidElement(tree)) return false;
      const el = tree as ReactElement<{ children?: ReactNode }>;
      if (el.type === ServerCard) return true;
      return hasServerCard(el.props.children);
    }
    expect(hasServerCard(node)).toBe(false);
    expect(treeHasType(node, Comp)).toBe(true);
  });

  it("custom widget does NOT pass Component as a prop to any wrapping element", async () => {
    // The whole reason this code path exists: a function prop can't cross
    // the RSC boundary, so no element in the returned tree may carry the
    // Component as a `Component` prop. (It should only appear as `type`.)
    const Comp = () => null;
    const widget: WidgetConfig = {
      kind: "custom",
      Component: Comp,
      props: {},
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg, reqCtx);

    function hasComponentProp(tree: ReactNode): boolean {
      if (tree === null || tree === undefined || typeof tree !== "object") return false;
      if (Array.isArray(tree)) return tree.some(hasComponentProp);
      if (!isValidElement(tree)) return false;
      const el = tree as ReactElement<{ Component?: unknown; children?: ReactNode }>;
      if (el.props.Component === Comp) return true;
      return hasComponentProp(el.props.children);
    }

    expect(hasComponentProp(node)).toBe(false);
  });
});

describe("renderWidget — table widget row projection", () => {
  it("drops an undeclared column from a resource-bound table widget's rows", async () => {
    // The adapter's raw row carries `passwordHash`, which the `users`
    // resource never declares as a column — a dashboard table binding to
    // `resource: "users"` must not leak it to the client.
    const boundAdapter: Adapter = {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
      inferSchema: () => ({}) as never,
      list: async () => ({
        rows: [{ id: "1", name: "Ann", passwordHash: "secret" }],
        total: 1,
        page: 1,
        pageSize: 10,
      }),
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => undefined,
    };
    const usersResource: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: { columns: ["id", "name"] },
    } as never;
    const boundCfg: ResolvedAdminConfig = {
      adapter: boundAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [usersResource],
      resourcesByName: new Map([["users", usersResource]]),
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never;
    const widget: WidgetConfig = {
      kind: "table",
      options: { resource: "users" },
    } as never;

    const node = await renderWidget(widget, ctx, boundCfg, reqCtx);
    expect(isValidElement(node)).toBe(true);
    const el = node as ReactElement<{ rows: Record<string, unknown>[] }>;
    expect(el.type).toBe(TableWidget);
    expect(el.props.rows).toEqual([{ id: "1", name: "Ann" }]);
    expect(el.props.rows[0]).not.toHaveProperty("passwordHash");
  });

  it("widens the projection with an explicit widget.options.columns override not on the resource", async () => {
    // The widget author explicitly asked for `note` even though it's not a
    // resource `columns` entry — that's a legitimate declaration for THIS
    // widget instance, so it must survive projection. `passwordHash` still
    // must not.
    const boundAdapter: Adapter = {
      kind: "drizzle",
      db: {},
      introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
      inferSchema: () => ({}) as never,
      list: async () => ({
        rows: [{ id: "1", name: "Ann", note: "vip", passwordHash: "secret" }],
        total: 1,
        page: 1,
        pageSize: 10,
      }),
      get: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => undefined,
    };
    const usersResource: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: { columns: ["id", "name"] },
    } as never;
    const boundCfg: ResolvedAdminConfig = {
      adapter: boundAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [usersResource],
      resourcesByName: new Map([["users", usersResource]]),
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never;
    const widget: WidgetConfig = {
      kind: "table",
      options: { resource: "users", columns: ["note"] },
    } as never;

    const node = await renderWidget(widget, ctx, boundCfg, reqCtx);
    const el = node as ReactElement<{ rows: Record<string, unknown>[] }>;
    // `name` stays too — it's still a declared column on the `users`
    // resource even though this particular widget doesn't render it.
    expect(el.props.rows).toEqual([{ id: "1", name: "Ann", note: "vip" }]);
    expect(el.props.rows[0]).not.toHaveProperty("passwordHash");
  });
});

describe("renderWidget — cross-resource authorization", () => {
  function boundConfig(
    resourceOptions: Record<string, unknown>,
    globalScope?: unknown,
  ): { cfg: ResolvedAdminConfig; list: ReturnType<typeof vi.fn> } {
    const list = vi.fn(async (_ref: unknown, _ctx: ListQueryContext<unknown>) => ({
      rows: [{ id: "1", name: "Ann" }],
      total: 1,
      page: 1,
      pageSize: 10,
    }));
    const usersResource: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: { columns: ["id", "name"], ...resourceOptions },
    } as never;
    const cfg: ResolvedAdminConfig = {
      adapter: { ...fakeAdapter, list },
      auth: { session: async () => null, role: () => "admin" },
      resources: [usersResource],
      resourcesByName: new Map([["users", usersResource]]),
      dashboardsByPath: new Map(),
      ...(globalScope ? { scope: globalScope } : {}),
      __resolved: true,
    } as never;
    return { cfg, list };
  }

  const tableWidget: WidgetConfig = {
    kind: "table",
    options: { resource: "users" },
  } as never;

  it("does not read a role-gated target the viewer cannot access", async () => {
    const { cfg, list } = boundConfig({ requireRole: "superadmin" });
    const staffCtx: RequestContext = { ...reqCtx, role: "staff" };
    const node = await renderWidget(tableWidget, ctx, cfg, staffCtx);
    const el = node as ReactElement<{ rows: Record<string, unknown>[] }>;
    expect(el.props.rows).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("does not read a target that declares no scope while global scope is active", async () => {
    const { cfg, list } = boundConfig({}, () => ({ tenantId: "t1" }));
    const node = await renderWidget(tableWidget, ctx, cfg, reqCtx);
    const el = node as ReactElement<{ rows: Record<string, unknown>[] }>;
    expect(el.props.rows).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("binds the target's scope predicate to the request's scope value", async () => {
    const scopePredicate = vi.fn((scope: unknown, query: unknown) => ({ scope, query }));
    const { cfg, list } = boundConfig({ scope: scopePredicate }, () => ({ tenantId: "t1" }));
    const scoped: RequestContext = { ...reqCtx, scope: { tenantId: "t1" } };
    await renderWidget(tableWidget, ctx, cfg, scoped);
    const listCtx = list.mock.calls[0]?.[1] as {
      applyScope?: (q: unknown) => unknown;
      scopeRequired?: boolean;
    };
    expect(listCtx.scopeRequired).toBe(true);
    listCtx.applyScope?.("q");
    expect(scopePredicate).toHaveBeenCalledWith({ tenantId: "t1" }, "q");
  });

  it("hands column render callbacks the caller's real role, never a blank one", async () => {
    const seenRoles: string[] = [];
    const usersResource: ResourceConfig = {
      __kind: "resource",
      ref: { __name: "users" },
      options: {
        columns: [
          {
            field: "name",
            render: (_row: unknown, c: RequestContext) => {
              seenRoles.push(c.role);
              return null;
            },
          },
        ],
      },
    } as never;
    const cfg: ResolvedAdminConfig = {
      adapter: fakeAdapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [usersResource],
      resourcesByName: new Map([["users", usersResource]]),
      dashboardsByPath: new Map(),
      __resolved: true,
    } as never;

    await renderWidget(tableWidget, ctx, cfg, reqCtx);
    expect(seenRoles).toEqual(["admin"]);
  });
});
