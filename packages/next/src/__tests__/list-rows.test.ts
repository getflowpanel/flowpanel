import type { Adapter, RequestContext } from "@flowpanel/core";
import { banner, dashboard, defineAdmin, list, RU_LABELS, resource } from "@flowpanel/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCardData } from "../runtime/list-rows";
import { buildWidgetContext } from "../runtime/widget-context";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 10 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [resource({ __name: "ai_run" }, { columns: ["id"] })],
  dashboards: [dashboard({ path: "/system", label: "System", sections: [] })],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const now = new Date("2026-09-21T12:00:00Z");
const ctx = () =>
  buildWidgetContext(config, reqCtx, reqCtx.req, { from: new Date(0), to: now, preset: "custom" });

const fires = [
  { key: "a", text: "Slow sync", tone: "info" as const, count: 90 },
  {
    key: "b",
    text: "Bans on kwork",
    tone: "warn" as const,
    count: 3,
    since: new Date("2026-09-21T09:00:00Z"),
  },
  { key: "c", text: "Scraper down", tone: "err" as const, count: 1 },
  { key: "d", text: "Queue backlog", tone: "warn" as const, count: 40 },
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe("listCardData", () => {
  it("orders a banner err, warn, info, then by count, and folds the rest into one line", async () => {
    const data = await listCardData(
      banner({ query: async () => fires, limit: 3, more: { dashboard: "/system" } }),
      ctx(),
      config,
    );
    expect(data.rows.map((row) => row.text)).toEqual([
      "Scraper down",
      "Queue backlog",
      "Bans on kwork",
    ]);
    expect(data.rows[2]).toMatchObject({ count: "3", since: "3 hours ago" });
    expect(data.more).toEqual({ text: "1 more", href: "/admin/system" });
    expect(data).toMatchObject({ variant: "banner", allClear: "All clear" });
  });

  it("keeps a plain list in its query's order, with an all-clear of its own on a banner", async () => {
    const data = await listCardData(list({ query: async () => fires }), ctx(), config);
    expect(data.rows.map((row) => row.key)).toEqual(["a", "b", "c", "d"]);
    expect(data.variant).toBeUndefined();
    expect(data.more).toBeUndefined();
    const quiet = await listCardData(
      banner({ query: async () => [], allClear: "Nothing on fire" }),
      ctx(),
      config,
    );
    expect(quiet).toMatchObject({ rows: [], allClear: "Nothing on fire" });
  });

  it("prints the age and the folded rest in the admin's language", async () => {
    const ru = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      labels: RU_LABELS,
      formatting: { locale: "ru-RU" },
      resources: [resource({ __name: "ai_run" }, { columns: ["id"] })],
      dashboards: [dashboard({ path: "/system", label: "System", sections: [] })],
    });
    const data = await listCardData(
      banner({ query: async () => fires, limit: 3, more: { dashboard: "/system" } }),
      buildWidgetContext(ru, reqCtx, reqCtx.req, { from: new Date(0), to: now, preset: "custom" }),
      ru,
    );
    expect(data.rows[2]).toMatchObject({ since: "3 часа назад" });
    expect(data.more?.text).toBe("ещё 1");
  });
});
