import type {
  Adapter,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetConfig,
  WidgetContext,
} from "@flowpanel/core";
import { DEFAULT_LABELS } from "@flowpanel/core";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderWidget } from "../runtime/render-widget";

interface TableProps {
  rows: Record<string, unknown>[];
  columns: Record<string, unknown>[];
  rowKey: string;
  hrefs?: (string | null)[];
  seeAllHref?: string;
  seeAllLabel?: string;
  emptyState?: ReactNode;
  prerenderedCells?: (ReactNode | undefined)[][];
}

const runs: ResourceConfig = {
  __kind: "resource",
  ref: { __name: "runs" },
  options: {
    rowKey: "runId",
    columns: [
      { field: "runId" },
      { field: "status", label: "Status", format: "badge" },
      { field: "durationMs", label: "Duration" },
    ],
  },
} as never;

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "runs", columns: [], primaryKey: "runId" }),
  inferSchema: () => ({}) as never,
  list: async () => ({
    rows: [{ runId: "r1", status: "running", durationMs: 4200 }],
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
  basePath: "/admin",
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [runs],
  resourcesByName: new Map([["runs", runs]]),
  dashboardsByPath: new Map(),
  __resolved: true,
} as never;

const reqCtx: RequestContext = {
  req: new Request("http://localhost/"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const ctx: WidgetContext = {
  db: {},
  session: null,
  dateRange: { from: new Date(0), to: new Date(), preset: "custom" },
  req: new Request("http://localhost/"),
  href: (resource, id) => (id === undefined ? `/admin/${resource}` : `/admin/${resource}/${id}`),
  query: (_key, fn) => fn(),
  labels: DEFAULT_LABELS,
  sql: async () => [],
  count: async () => 0,
};

async function props(widget: WidgetConfig): Promise<TableProps> {
  const node = (await renderWidget(widget, ctx, cfg, reqCtx)) as ReactElement<TableProps>;
  return node.props;
}

describe("table widget columns", () => {
  it("names and formats a column the query produced itself", async () => {
    const rendered = await props({
      kind: "table",
      options: {
        query: async () => [{ id: "1", amount: 1200 }],
        columns: ["id", { field: "amount", label: "Amount", format: "money", align: "right" }],
      },
    } as never);
    expect(rendered.columns).toEqual([
      { field: "id" },
      { field: "amount", label: "Amount", format: "money", align: "right" },
    ]);
  });

  it("takes a bare key's header and format from the resource", async () => {
    const rendered = await props({
      kind: "table",
      options: { resource: "runs", columns: ["status"] },
    } as never);
    expect(rendered.columns).toEqual([{ field: "status", label: "Status", format: "badge" }]);
  });

  it("lets a column object override what the resource declared", async () => {
    const rendered = await props({
      kind: "table",
      options: { resource: "runs", columns: [{ field: "status", label: "State" }] },
    } as never);
    expect(rendered.columns).toEqual([{ field: "status", label: "State", format: "badge" }]);
  });
});

describe("table widget row identity", () => {
  it("takes the row key from the resource", async () => {
    const rendered = await props({ kind: "table", options: { resource: "runs" } } as never);
    expect(rendered.rowKey).toBe("runId");
  });

  it("falls back to id on the query path, and honours an explicit key", async () => {
    const query = async () => [{ id: "1", slug: "a" }];
    expect((await props({ kind: "table", options: { query } } as never)).rowKey).toBe("id");
    expect(
      (await props({ kind: "table", options: { query, rowKey: "slug" } } as never)).rowKey,
    ).toBe("slug");
  });
});

describe("table widget row links", () => {
  it("computes one href per row on the server", async () => {
    const rendered = await props({
      kind: "table",
      options: {
        query: async () => [{ id: "1" }, { id: "2" }],
        rowHref: (row: { id: string }, c: WidgetContext) => c.href("runs", row.id),
      },
    } as never);
    expect(rendered.hrefs).toEqual(["/admin/runs/1", "/admin/runs/2"]);
  });

  it("leaves a row the config declines to link inert", async () => {
    const rendered = await props({
      kind: "table",
      options: {
        query: async () => [{ id: "1" }, { id: null }],
        rowHref: (row: { id: string | null }) => (row.id ? `/admin/runs/${row.id}` : null),
      },
    } as never);
    expect(rendered.hrefs).toEqual(["/admin/runs/1", null]);
  });

  it("gives a row it cannot address no href, whatever rowHref returns", async () => {
    const rendered = await props({
      kind: "table",
      options: {
        query: async () => [{ id: "1" }, { id: null }, { id: { nested: true } }, {}],
        rowHref: () => "/admin/runs/always",
      },
    } as never);
    expect(rendered.hrefs).toEqual(["/admin/runs/always", null, null, null]);
  });

  it("passes no hrefs at all when the config declares no rowHref", async () => {
    const rendered = await props({
      kind: "table",
      options: { query: async () => [{ id: "1" }] },
    } as never);
    expect(rendered.hrefs).toBeUndefined();
  });
});

describe("table widget heading, empty state and cap", () => {
  it("links the heading to the resource's own list for seeAll: true", async () => {
    const rendered = await props({
      kind: "table",
      options: { resource: "runs", label: "Recent runs", seeAll: true },
    } as never);
    expect(rendered.seeAllHref).toBe("/admin/runs");
    expect(rendered.seeAllLabel).toBe(DEFAULT_LABELS.widget.seeAll);
  });

  it("uses a seeAll string as the href", async () => {
    const rendered = await props({
      kind: "table",
      options: { query: async () => [], seeAll: "/reports/runs" },
    } as never);
    expect(rendered.seeAllHref).toBe("/reports/runs");
  });

  it("renders the configured empty state, and the label otherwise", async () => {
    const configured = await props({
      kind: "table",
      options: { query: async () => [], emptyState: "No runs yet" },
    } as never);
    expect(configured.emptyState).toBe("No runs yet");
    const fallback = await props({ kind: "table", options: { query: async () => [] } } as never);
    expect(fallback.emptyState).toBe(DEFAULT_LABELS.widget.empty);
  });

  it("caps a query's own rows at the configured limit", async () => {
    const query = async () => [{ id: "1" }, { id: "2" }, { id: "3" }];
    expect(
      (await props({ kind: "table", options: { query, limit: 2 } } as never)).rows,
    ).toHaveLength(2);
    expect((await props({ kind: "table", options: { query } } as never)).rows).toHaveLength(3);
  });
});
