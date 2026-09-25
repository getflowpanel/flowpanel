import type { Adapter, ColumnMeta, RequestContext } from "@flowpanel/core";
import { defineAdmin, resource, table } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { renderTableWidget } from "../runtime/render-table-widget";
import { fakeWidgetContext } from "./widget-context-fixture";

const seen: Record<string, unknown>[] = [];
const meta = (name: string): ColumnMeta => ({
  name,
  type: name === "startedAt" ? "date" : "string",
  nullable: false,
  unique: name === "id",
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({
    name: "visits",
    columns: ["id", "userId", "startedAt"].map(meta),
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async (_ref, ctx) => {
    seen.push((ctx as { filters: Record<string, unknown> }).filters);
    return { rows: [], total: 0, page: 1, pageSize: 10 };
  },
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [resource({ __name: "visits" }, { columns: ["id", "userId", "startedAt"] })],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const from = new Date("2026-09-01T00:00:00Z");
const to = new Date("2026-09-08T00:00:00Z");
const ctx = fakeWidgetContext({
  dateRange: { from, to, preset: "last7d", previous: null, timeZone: "UTC" },
});

describe("table({ resource, where, range })", () => {
  it("reads the rows its where names, bounded by the picked range", async () => {
    await renderTableWidget(
      table({ resource: "visits", where: { userId: "u1" }, range: "startedAt" }),
      ctx,
      config,
      reqCtx,
    );
    expect(seen.at(-1)).toEqual({ userId: "u1", startedAt: { op: "range", gte: from, lte: to } });
  });

  it("reads nothing for an empty set", async () => {
    const before = seen.length;
    await renderTableWidget(
      table({ resource: "visits", where: { userId: [] } }),
      ctx,
      config,
      reqCtx,
    );
    expect(seen.length).toBe(before);
  });

  it("throws on a missing value instead of reading every row", async () => {
    await expect(
      renderTableWidget(
        table({ resource: "visits", where: (c) => ({ userId: c.id }) }),
        ctx,
        config,
        reqCtx,
      ),
    ).rejects.toThrow(/userId/);
  });
});
