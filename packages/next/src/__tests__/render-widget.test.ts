import type {
  Adapter,
  ResolvedAdminConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { RealtimeRefresh, TableWidget } from "@flowpanel/react";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
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

describe("renderWidget — realtime wiring", () => {
  it("metric widget mounts a RealtimeRefresh subscriber when options.realtime is set", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: { realtime: "resource.orders" },
    } as never;
    const node = await renderWidget(widget, ctx, cfg);
    expect(findRealtimeChannels(node)).toBe("resource.orders");
  });

  it("metric widget omits the subscriber when options.realtime is undefined", async () => {
    const widget: WidgetConfig = {
      kind: "metric",
      label: "Orders today",
      query: async () => 12,
      options: {},
    } as never;
    const node = await renderWidget(widget, ctx, cfg);
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
    const node = await renderWidget(widget, ctx, cfg);
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
    const node = await renderWidget(widget, ctx, cfg);
    expect(findRealtimeChannels(node)).toEqual(["resource.a", "resource.b"]);
  });

  it("statGroup widget mounts a RealtimeRefresh subscriber when options.realtime is set", async () => {
    const widget: WidgetConfig = {
      kind: "statGroup",
      options: { stats: [{ label: "x", value: 1 }], realtime: "resource.kpi" },
    } as never;
    const node = await renderWidget(widget, ctx, cfg);
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
    const node = await renderWidget(widget, ctx, cfg);

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
    const node = await renderWidget(widget, ctx, cfg);

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
    const node = await renderWidget(widget, ctx, cfg);

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
    const node = await renderWidget(widget, ctx, cfg);

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
