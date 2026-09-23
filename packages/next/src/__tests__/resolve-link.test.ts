import type { Adapter, RequestContext, ResolvedDateRange } from "@flowpanel/core";
import { dashboard, defineAdmin, page, resource } from "@flowpanel/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDateRange } from "../runtime/date-range";
import { parseListParams, sanitizeFilterValues } from "../runtime/parse-list-params";
import { resolveLink } from "../runtime/resolve-link";
import { buildWidgetContext, detailTabDateRange } from "../runtime/widget-context";
import { fakeWidgetContext } from "./widget-context-fixture";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource(
      { __name: "scraper_run" },
      {
        columns: ["id"],
        views: [
          {
            name: "Ошибки",
            filters: { status: "error" },
            sort: { field: "startedAt", dir: "desc" },
          },
        ],
      },
    ),
  ],
  dashboards: [
    dashboard({ path: "/", label: "Pulse", sections: [] }),
    dashboard({ path: "/system", label: "System", sections: [] }),
  ],
  pages: [page({ path: "/reports/weekly", label: "Weekly", component: () => null })],
});

const reqCtx: RequestContext = {
  req: new Request("http://localhost/admin"),
  session: null,
  role: "admin",
  scope: null,
  ip: null,
  userAgent: null,
};

const week = {
  from: new Date("2026-09-14T00:00:00Z"),
  to: new Date("2026-09-21T00:00:00Z"),
  preset: "last7d" as const,
};
const ctx = () => buildWidgetContext(config, reqCtx, reqCtx.req, week);

describe("resolveLink — resources", () => {
  it("builds the list, a record and one of its tabs under the admin's mount", () => {
    expect(resolveLink(config, ctx(), { resource: "scraper_run" })).toBe("/admin/scraper_run");
    expect(resolveLink(config, ctx(), { resource: "scraper_run", id: "r 1", tab: "log" })).toBe(
      "/admin/scraper_run/r%201?tab=log",
    );
  });

  it("applies a view by name, then the link's own filters", () => {
    expect(
      resolveLink(config, ctx(), {
        resource: "scraper_run",
        view: "Ошибки",
        filter: { platform: "kwork" },
      }),
    ).toBe("/admin/scraper_run?sort=startedAt%3Adesc&f_status=error&f_platform=kwork");
  });

  it("carries the widget's range into a daterange filter, bound for bound", () => {
    expect(resolveLink(config, ctx(), { resource: "scraper_run", range: "startedAt" })).toBe(
      "/admin/scraper_run?f_startedAt=2026-09-14T00%3A00%3A00.000Z%7E2026-09-21T00%3A00%3A00.000Z",
    );
  });

  it("writes a Date filter as its day in the admin's zone", () => {
    const moscow = fakeWidgetContext({
      dateRange: { ...week, previous: null, timeZone: "Europe/Moscow" },
    });
    expect(
      resolveLink(config, moscow, {
        resource: "scraper_run",
        filter: { day: new Date("2026-09-22T22:00:00Z") },
      }),
    ).toBe("/admin/scraper_run?f_day=2026-09-23");
  });

  it("carries no range from a detail tab's whole history", () => {
    const detail = buildWidgetContext(config, reqCtx, reqCtx.req, detailTabDateRange(), {
      id: "u1",
    });
    expect(resolveLink(config, detail, { resource: "scraper_run", range: "startedAt" })).toBe(
      "/admin/scraper_run",
    );
  });

  it("names an unknown resource or view with what is registered", () => {
    expect(() => resolveLink(config, ctx(), { resource: "scraper_runs" })).toThrow(
      /no such resource\. Registered: scraper_run/,
    );
    expect(() => resolveLink(config, ctx(), { resource: "scraper_run", view: "Errors" })).toThrow(
      /no such view\. Views: Ошибки/,
    );
  });
});

describe("resolveLink — dashboards and pages", () => {
  it("carries the preset to another dashboard", () => {
    expect(resolveLink(config, ctx(), { dashboard: "/system" })).toBe(
      "/admin/system?preset=last7d",
    );
  });

  it("carries a custom range as from and to, or nothing when told not to", () => {
    const custom = buildWidgetContext(config, reqCtx, reqCtx.req, { ...week, preset: "custom" });
    expect(resolveLink(config, custom, { dashboard: "system" })).toBe(
      "/admin/system?from=2026-09-14T00%3A00%3A00.000Z&to=2026-09-21T00%3A00%3A00.000Z",
    );
    expect(resolveLink(config, ctx(), { dashboard: "/system", range: false })).toBe(
      "/admin/system",
    );
  });

  it("reaches a page and the landing page", () => {
    expect(resolveLink(config, ctx(), { dashboard: "/reports/weekly", range: false })).toBe(
      "/admin/reports/weekly",
    );
    expect(resolveLink(config, ctx(), { dashboard: "/", range: false })).toBe("/admin");
  });

  it("names an unknown dashboard with what is registered", () => {
    expect(() => resolveLink(config, ctx(), { dashboard: "/sytem" })).toThrow(
      /no such dashboard or page\. Registered: \/, \/system, \/reports\/weekly/,
    );
  });
});

describe("resolveLink — strings and functions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a string as written and warns once when it spells the mount", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveLink(config, ctx(), "/admin/scraper_run?x=1")).toBe("/admin/scraper_run?x=1");
    expect(resolveLink(config, ctx(), "/admin/scraper_run?x=1")).toBe("/admin/scraper_run?x=1");
    expect(resolveLink(config, ctx(), "https://kwork.ru")).toBe("https://kwork.ru");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("spells the admin's mount path");
  });

  it("calls a function with the widget context and resolves what it returns", () => {
    expect(
      resolveLink(config, ctx(), (c) => ({
        resource: "scraper_run",
        filter: { preset: c.dateRange.preset },
      })),
    ).toBe("/admin/scraper_run?f_preset=last7d");
    expect(resolveLink(config, ctx(), () => null)).toBeUndefined();
    expect(resolveLink(config, ctx(), undefined)).toBeUndefined();
  });

  it("is what ctx.link returns", () => {
    expect(ctx().link({ dashboard: "/system", range: false })).toBe("/admin/system");
  });
});

describe("a range link lands on the rows its number counted", () => {
  const specs = [{ field: "startedAt", type: "daterange" as const }];

  afterEach(() => {
    vi.useRealTimers();
  });

  function listed(range: ResolvedDateRange) {
    const linked = buildWidgetContext(config, reqCtx, reqCtx.req, range);
    const href = resolveLink(config, linked, { resource: "scraper_run", range: "startedAt" }) ?? "";
    const { filters } = parseListParams(new URL(href, "http://localhost").searchParams);
    const out = sanitizeFilterValues(filters, specs, "Europe/Moscow");
    return out.startedAt as { gte: Date; lte: Date };
  }

  it.each(["today", "last7d"] as const)("keeps Moscow %s to the instants it counted", (preset) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T07:00:00Z"));
    const range = resolveDateRange({ preset }, "Europe/Moscow");
    const rows = listed(range);
    expect(rows.gte).toEqual(range.from);
    expect(rows.lte.getTime()).toBeLessThanOrEqual(range.to.getTime());
  });

  it("keeps a custom range to its instants", () => {
    const rows = listed({ ...week, preset: "custom" });
    expect(rows.gte).toEqual(week.from);
    expect(rows.lte.getTime()).toBeLessThanOrEqual(week.to.getTime());
  });
});
