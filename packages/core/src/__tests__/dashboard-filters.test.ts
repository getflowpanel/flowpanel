import { describe, expect, it } from "vitest";
import type { Adapter, DashboardFilter } from "../index";
import { bars, dashboard, defineAdmin, metric, resource, tracker } from "../index";

const fakeAdapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as any, update: {} as any, select: {} as any }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};
const base = {
  adapter: fakeAdapter,
  auth: { session: async () => null, role: () => "admin" as const },
};
const platform: DashboardFilter = {
  key: "platform",
  label: "Marketplace",
  options: [{ label: "Kwork", value: "kwork" }],
};

describe("dashboard filters", () => {
  it("accepts a widget and a link that set a declared filter", () => {
    expect(() =>
      defineAdmin({
        ...base,
        dashboards: [
          dashboard({
            path: "/parsing",
            label: "Parsing",
            filters: [platform],
            sections: [{ widgets: [bars({ filterOnClick: "platform", query: async () => [] })] }],
          }),
          dashboard({
            path: "/",
            label: "Pulse",
            sections: [
              {
                widgets: [
                  metric("Orders", async () => 1, {
                    drilldown: { dashboard: "/parsing", filter: { platform: "kwork" } },
                  }),
                ],
              },
            ],
          }),
        ],
      }),
    ).not.toThrow();
  });

  it("names the widget and the filter it probably meant", () => {
    expect(() =>
      defineAdmin({
        ...base,
        dashboards: [
          dashboard({
            path: "/parsing",
            label: "Parsing",
            filters: [platform],
            sections: [{ widgets: [tracker({ filterOnClick: "platfrom", rows: async () => [] })] }],
          }),
        ],
      }),
    ).toThrow(
      /dashboard "\/parsing" sections\[0\]\.widgets\[0\]: it sets filterOnClick "platfrom", which the dashboard does not declare\. Did you mean "platform"\?/,
    );
  });

  it("names a link that sets a filter its dashboard does not declare", () => {
    expect(() =>
      defineAdmin({
        ...base,
        dashboards: [
          dashboard({ path: "/parsing", label: "Parsing", filters: [platform], sections: [] }),
          dashboard({
            path: "/",
            label: "Pulse",
            sections: [
              {
                widgets: [
                  metric("Orders", async () => 1, {
                    drilldown: { dashboard: "/parsing", filter: { platfrom: "kwork" } },
                  }),
                ],
              },
            ],
          }),
        ],
      }),
    ).toThrow(
      /options\.drilldown\.filter: it names dashboard filter "platfrom" on "\/parsing".*Did you mean "platform"\?/s,
    );
  });

  it("rejects a filter declared twice and a filter on a record page", () => {
    expect(() =>
      defineAdmin({
        ...base,
        dashboards: [
          dashboard({
            path: "/x",
            label: "X",
            filters: [platform, { ...platform, label: "Again" }],
            sections: [],
          }),
        ],
      }),
    ).toThrow(/dashboard "\/x" filters: the filter "platform" is declared twice/);
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource("users", {
            columns: [],
            detail: {
              tabs: [
                {
                  key: "t",
                  label: "T",
                  widgets: [bars({ filterOnClick: "platform", query: async () => [] })],
                },
              ],
            },
          }),
        ],
      }),
    ).toThrow(/resource "users" detail\.tabs\[0\]\.widgets\[0\]: it sets filterOnClick "platform"/);
  });

  it("rejects a filter on drawer tabs, detail aside and detail stats", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource("users", {
            columns: [],
            drawer: {
              tabs: [
                {
                  key: "t",
                  label: "T",
                  widgets: [bars({ filterOnClick: "platform", query: async () => [] })],
                },
              ],
            },
          }),
        ],
      }),
    ).toThrow(/resource "users" drawer\.tabs\[0\]\.widgets\[0\]: it sets filterOnClick "platform"/);
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource("users", {
            columns: [],
            detail: { aside: [bars({ filterOnClick: "platform", query: async () => [] })] },
          }),
        ],
      }),
    ).toThrow(/resource "users" detail\.aside\[0\]: it sets filterOnClick "platform"/);
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource("users", {
            columns: [],
            detail: { stats: [metric("M", async () => 1, { filterOnClick: "platform" } as never)] },
          }),
        ],
      }),
    ).toThrow(/resource "users" detail\.stats\[0\]: it sets filterOnClick "platform"/);
  });
});
