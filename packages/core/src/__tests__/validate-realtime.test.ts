import { describe, expect, it } from "vitest";
import type { Adapter } from "../index";
import { dashboard, defineAdmin, metric, resource } from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: null,
  introspect: () => ({ name: "x", columns: [], primaryKey: "id" }),
  inferSchema: () => ({ create: {} as never, update: {} as never, select: {} as never }),
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

function admin(onDashboard: unknown, onCard?: unknown, onDrawer?: unknown): () => unknown {
  return () =>
    defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource(
          { __name: "orders" },
          {
            columns: ["id"],
            ...(onCard === undefined
              ? {}
              : {
                  detail: {
                    tabs: [
                      {
                        key: "live",
                        label: "Live",
                        widgets: [metric("Open", async () => 1, { realtime: onCard as never })],
                      },
                    ],
                  },
                }),
            ...(onDrawer === undefined
              ? {}
              : {
                  drawer: {
                    tabs: [
                      {
                        key: "live",
                        label: "Live",
                        widgets: [metric("Queued", async () => 1, { realtime: onDrawer as never })],
                      },
                    ],
                  },
                }),
          },
        ),
      ],
      dashboards: [
        dashboard({
          path: "/",
          label: "Pulse",
          sections: [
            { widgets: [metric("Orders", async () => 1, { realtime: onDashboard as never })] },
          ],
        }),
      ],
    });
}

describe("realtime { resource } targets", () => {
  it("accept channel names and registered resources", () => {
    expect(admin(["pipeline", { resource: "orders" }])).not.toThrow();
    expect(admin("pipeline", { resource: "orders" })).not.toThrow();
  });

  it("name the widget, the dashboard and the resource that was meant", () => {
    expect(admin({ resource: "ordres" })).toThrow(
      'flowpanel: the metric "Orders" on dashboard "/" subscribes to realtime { resource: "ordres" }, which is not a registered resource. Did you mean "orders"?',
    );
  });

  it("are checked on record-page widgets too", () => {
    expect(admin("pipeline", [{ resource: "order" }])).toThrow(
      'the metric "Open" on the "orders" record page subscribes to realtime { resource: "order" }',
    );
  });

  it("are checked on drawer widgets too", () => {
    expect(admin("pipeline", undefined, { resource: "ordr" })).toThrow(
      'the metric "Queued" on the "orders" drawer subscribes to realtime { resource: "ordr" }',
    );
  });
});
