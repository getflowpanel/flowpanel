import { describe, expect, it } from "vitest";
import {
  type Adapter,
  checklist,
  dashboard,
  defineAdmin,
  resource,
  type TimelineWidget,
  timeline,
  tracker,
} from "../index";

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: [{ name: "id", type: "string", nullable: false, unique: true, primaryKey: true }],
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const events = () => timeline({ kinds: { visit: "Visit" }, query: async () => [] });

function admin(options: Record<string, unknown>) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [resource({ __name: "users" }, { columns: ["id"], ...options } as never)],
  });
}

describe("timelines at defineAdmin", () => {
  it("names a detail tab's timelines after the tab", () => {
    const config = admin({
      detail: {
        tabs: [
          { key: "activity", label: "Activity", widgets: [events(), events()] },
          { key: "own", label: "Own", widgets: [timeline({ kinds: {}, id: "mine" })] },
        ],
      },
    });
    const tabs = config.resourcesByName.get("users")?.options.detail?.tabs ?? [];
    const ids = tabs.map((tab) =>
      (tab.widgets as TimelineWidget[]).map((widget) => widget.options.id),
    );
    expect(ids).toEqual([["activity", "activity-2"], ["mine"]]);
  });

  it("gives every other timeline on a page its own id", () => {
    const config = admin({
      detail: {
        aside: [events(), events()],
        tabs: [{ key: "timeline", label: "Timeline", widgets: [events()] }],
      },
    });
    const aside = (config.resourcesByName.get("users")?.options.detail?.aside ??
      []) as TimelineWidget[];
    expect(aside.map((widget) => widget.options.id)).toEqual(["timeline-2", "timeline-3"]);

    const board = defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      dashboards: [
        dashboard({
          path: "/ops",
          label: "Ops",
          sections: [
            { widgets: [events()] },
            { widgets: [events(), timeline({ kinds: {}, id: "timeline-2" })] },
          ],
        }),
      ],
    });
    const widgets = (board.dashboardsByPath.get("/ops")?.sections ?? []).flatMap(
      (section) => section.widgets as TimelineWidget[],
    );
    expect(widgets.map((widget) => widget.options.id)).toEqual([
      "timeline",
      "timeline-3",
      "timeline-2",
    ]);
    expect((board.dashboards![0]!.sections[0]!.widgets[0] as TimelineWidget).options.id).toBe(
      "timeline",
    );
  });

  it("refuses two timelines on one page that share an id", () => {
    expect(() =>
      admin({
        detail: {
          aside: [timeline({ kinds: {}, id: "log" })],
          tabs: [{ key: "t", label: "T", widgets: [timeline({ kinds: {}, id: "log" })] }],
        },
      }),
    ).toThrow(
      '[flowpanel] resource "users" detail.tabs[0].widgets[0]: a second timeline on the page has ' +
        'the id "log". Give each timeline its own id.',
    );
  });

  it("refuses a timeline in a drawer and points at a detail tab", () => {
    expect(() =>
      admin({ drawer: { tabs: [{ key: "t", label: "T", widgets: [events()] }] } }),
    ).toThrow(
      '[flowpanel] resource "users" drawer.tabs[0].widgets[0]: a timeline renders only on a page, ' +
        "not in a drawer. Put it in a detail tab (detail.tabs[].widgets).",
    );
  });
});

describe("checklists at defineAdmin", () => {
  it("refuses a checklist in a drawer and points at a detail tab", () => {
    expect(() =>
      admin({ drawer: { tabs: [{ key: "t", label: "T", widgets: [checklist({ items: [] })] }] } }),
    ).toThrow(
      '[flowpanel] resource "users" drawer.tabs[0].widgets[0]: a checklist renders only on a page, ' +
        "not in a drawer. Put it in a detail tab (detail.tabs[].widgets).",
    );
  });
});

describe("trackers at defineAdmin", () => {
  it("refuses a tracker in a drawer and points at a detail tab", () => {
    const status = tracker({ rows: async () => [], window: "24h" });
    expect(() =>
      admin({ drawer: { tabs: [{ key: "t", label: "T", widgets: [status] }] } }),
    ).toThrow(
      '[flowpanel] resource "users" drawer.tabs[0].widgets[0]: a tracker renders only on a page, ' +
        "not in a drawer. Put it in a detail tab (detail.tabs[].widgets).",
    );
  });
});
