import type { Adapter, ColumnMeta, HeatmapWidget, RequestContext } from "@flowpanel/core";
import { defineAdmin, heatmap, resource } from "@flowpanel/core";
import { dayStartIn } from "@flowpanel/core/internal";
import { HeatmapCard, type HeatmapCardProps } from "@flowpanel/react";
import type { ReactElement } from "react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHeatmap } from "../runtime/render-heatmap";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";
import { retainedRange } from "../runtime/widget-range";

type Row = Record<string, unknown>;
const VISITS: Row[] = [
  { id: "v1", userId: "u1", startedAt: new Date("2026-09-25T09:00:00Z") },
  { id: "v2", userId: "u1", startedAt: new Date("2026-09-25T10:00:00Z") },
  { id: "v3", userId: "u1", startedAt: new Date("2026-09-22T10:00:00Z") },
];
let bulk = 0;
const calls: Row[] = [];
const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: name === "id",
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: ["id", "userId", "startedAt"].map(meta),
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async (ref, ctx) => {
    const { filters, pageSize } = ctx as { filters: Row; pageSize: number };
    calls.push(filters);
    const rows =
      (ref as { __name: string }).__name === "bulk"
        ? Array.from({ length: bulk }, (_, i) => ({
            id: `b${i}`,
            userId: "u1",
            startedAt: new Date("2026-09-25T09:00:00Z"),
          }))
        : VISITS;
    return { rows: rows.slice(0, pageSize), total: rows.length, page: 1, pageSize };
  },
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const toUser = { resource: "users", labelField: "id" };
const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource({ __name: "users" }, { columns: ["id"] }),
    resource(
      { __name: "visits" },
      { columns: ["id", { field: "userId", reference: toUser }, "startedAt"] },
    ),
    resource(
      { __name: "bulk" },
      { columns: ["id", { field: "userId", reference: toUser }, "startedAt"] },
    ),
  ],
});
const url = "http://localhost/admin/users/u1";
const reqCtx = {
  req: new Request(url),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
} as RequestContext;
const card = () =>
  buildWidgetContext(
    config,
    reqCtx,
    new Request(url),
    detailTabDateRange(),
    { id: "u1" },
    "id",
    "users",
  );

async function props(widget: HeatmapWidget, ctx = card()): Promise<HeatmapCardProps> {
  const node = (await renderHeatmap(widget, ctx, config, reqCtx)) as ReactElement<HeatmapCardProps>;
  expect(node.type).toBe(HeatmapCard);
  return node.props;
}

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T12:00:00Z"));
});
afterAll(() => vi.useRealTimers());
beforeEach(() => {
  calls.length = 0;
});

describe("renderHeatmap", () => {
  it("reads the record's rows of the last days and buckets them by day", async () => {
    const p = await props(
      heatmap({
        label: "Visits",
        days: 7,
        unit: { one: "{n} visit", other: "{n} visits" },
        source: { resource: "visits", at: "startedAt" },
      }),
    );
    expect(calls[0]).toEqual({
      userId: "u1",
      startedAt: { op: "range", gte: dayStartIn("2026-09-19", "UTC") },
    });
    expect(p.summary).toBe("3 visits in the last 7 days");
    const cells = p.weeks.flat().filter((cell) => cell !== null);
    expect(cells).toHaveLength(7);
    expect(cells.at(-1)).toMatchObject({
      level: 4,
      title: `${card().format.date("2026-09-25")}: 2 visits`,
    });
    expect(p.weeks).toHaveLength(2);
  });

  it("takes per-day totals from a query", async () => {
    const p = await props(
      heatmap({ days: 7, query: async () => [{ at: "2026-09-24", value: 5 }] }),
    );
    expect(p.summary).toBe("5 in the last 7 days");
    expect(calls).toHaveLength(0);
  });

  it("refuses a source past 10,000 rows and names query", async () => {
    bulk = 10_001;
    await expect(
      renderHeatmap(
        heatmap({ source: { resource: "bulk", at: "startedAt" } }),
        card(),
        config,
        reqCtx,
      ),
    ).rejects.toThrow(
      'flowpanel: heatmap reads more than 10,000 rows of "bulk"; total them per day in SQL and pass query instead.',
    );
  });

  it("shows the empty state for a period with nothing in it", async () => {
    const p = await props(heatmap({ days: 7, emptyState: "No visits", query: async () => [] }));
    expect(p.emptyState).toBe("No visits");
    expect(p.summary).toBe("0 in the last 7 days");
  });

  it("keeps its own last days whatever the picked range", () => {
    const base = card();
    const old = {
      ...base,
      dateRange: {
        ...base.dateRange,
        from: new Date("2026-01-01T00:00:00Z"),
        to: new Date("2026-02-01T00:00:00Z"),
      },
    };
    expect(retainedRange(heatmap({ query: async () => [] }), old)).toEqual({
      expired: false,
      ctx: old,
      keptSince: null,
    });
  });
});
