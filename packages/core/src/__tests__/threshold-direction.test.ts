import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { bars, dashboard, defineAdmin, metric, resource, stat, tracker } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: () => ({ name: "runs", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as any, update: {} as any, select: {} as any }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => {},
};
const base = { adapter, auth: { session: async () => null, role: () => "admin" as const } };

function boardWith(widget: unknown) {
  return defineAdmin({
    ...base,
    dashboards: [
      dashboard({ path: "/", label: "Pulse", sections: [{ widgets: [widget as never] }] }),
    ],
  });
}

describe("threshold direction at defineAdmin", () => {
  it("accepts thresholds whose goodWhen agrees with their numbers, or has none", () => {
    expect(() =>
      boardWith(metric("Success", async () => 97, { tones: { warn: 95, err: 90 } })),
    ).not.toThrow();
    expect(() =>
      boardWith(stat("Errors", 3, { tones: { warn: 5, err: 10, goodWhen: "down" } })),
    ).not.toThrow();
    expect(() =>
      boardWith(bars({ goodWhen: "up", tones: { warn: 0.9, err: 0.8 }, query: async () => [] })),
    ).not.toThrow();
  });

  it("throws when a threshold's own goodWhen contradicts its numbers", () => {
    expect(() =>
      boardWith(
        metric("Success", async () => 97, { tones: { warn: 95, err: 90, goodWhen: "down" } }),
      ),
    ).toThrow(
      'dashboard "/" sections[0].widgets[0] tones { warn: 95, err: 90 } read as lower is worse, but its goodWhen is "down". Swap warn and err, or set goodWhen: "up".',
    );
  });

  it("throws when the card's goodWhen contradicts its threshold", () => {
    expect(() =>
      boardWith(tracker({ goodWhen: "up", tones: { warn: 1, err: 5 }, rows: async () => [] })),
    ).toThrow(/read as higher is worse, but the card's goodWhen is "up"/);
  });

  it("checks a column format's threshold too", () => {
    expect(() =>
      defineAdmin({
        ...base,
        resources: [
          resource(
            {} as never,
            {
              name: "runs",
              columns: [
                {
                  field: "rate",
                  format: { kind: "percent", tones: { warn: 0.9, err: 0.8, goodWhen: "down" } },
                },
              ],
            } as never,
          ),
        ],
      }),
    ).toThrow(/resource "runs" columns\[0\]\.format tones/);
  });
});
