import { afterEach, describe, expect, it, vi } from "vitest";
import { resetDevWarningsForTests } from "../compiler/validate/warn-create-fields";
import type { Adapter, WidgetConfig } from "../index";
import { areaChart, dashboard, defineAdmin, lineChart } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "t", columns: [], primaryKey: "id" }),
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const rows = async () => [{ day: "2026-10-01", amount: 260000 }];

function admin(widgets: WidgetConfig[]) {
  return defineAdmin({
    adapter,
    auth: { session: async () => ({ id: "u1" }), role: () => "admin", access: "admin" },
    dashboards: [dashboard({ path: "/billing", label: "Billing", sections: [{ widgets }] })],
  });
}

afterEach(() => {
  resetDevWarningsForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a chart with minorUnits and no currency format", () => {
  it("names the widget, what minorUnits does and the fix", () => {
    const { warnings } = admin([
      lineChart("Revenue", rows, { x: "day", y: "amount", minorUnits: 2 }),
    ]);
    expect(warnings).toEqual([
      'dashboard "/billing" sections[0].widgets[0] minorUnits: it divides every value by 100, but it has no format, so the axis and tooltips show plain numbers. Add format: "currency", or drop minorUnits.',
    ]);
  });

  it("names a format that is not currency", () => {
    const { warnings } = admin([
      areaChart("Revenue", rows, { x: "day", minorUnits: 2, format: "number" }),
    ]);
    expect(warnings[0]).toContain('its format is "number"');
  });

  it("stays quiet with format: currency or without minorUnits", () => {
    expect(
      admin([
        lineChart("Revenue", rows, { x: "day", minorUnits: 2, format: "currency" }),
        lineChart("Runs", rows, { x: "day" }),
      ]).warnings,
    ).toEqual([]);
  });

  it("prints once per process in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const widgets = [lineChart("Margin", rows, { x: "day", minorUnits: 3 })];
    admin(widgets);
    admin(widgets);
    expect(warn.mock.calls.filter(([line]) => String(line).includes("minorUnits"))).toHaveLength(1);
  });

  it("stays quiet in the worker next dev forks for a static-params pass", () => {
    vi.stubEnv("NODE_ENV", "development");
    const argv = process.argv;
    process.argv = [
      argv[0] ?? "node",
      "/app/node_modules/next/dist/compiled/jest-worker/processChild.js",
    ];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      admin([lineChart("Worker", rows, { x: "day", minorUnits: 2 })]);
    } finally {
      process.argv = argv;
    }
    expect(warn.mock.calls.filter(([line]) => String(line).includes("minorUnits"))).toEqual([]);
  });
});
