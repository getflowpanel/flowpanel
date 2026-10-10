import { describe, expect, it } from "vitest";
import type {
  Adapter,
  AnyResourceConfig,
  ColumnMeta,
  MetricWidget,
  StatWidget,
  WidgetConfig,
} from "../index";
import { dashboard, defineAdmin, kv, metric, resource, table } from "../index";

const COLUMNS: Record<string, string[]> = {
  scraper_run: ["id", "platform", "status", "startedAt"],
  user: ["id", "email", "createdAt"],
  response: ["id", "userId", "sentAt"],
};

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

const adapter: Adapter = {
  kind: "drizzle",
  db: {},
  introspect: (ref) => {
    const name = (ref as { __name: string }).__name;
    return { name, columns: (COLUMNS[name] ?? []).map(meta), primaryKey: "id" };
  },
  inferSchema: () =>
    ({ create: {}, update: {}, select: {} }) as unknown as ReturnType<Adapter["inferSchema"]>,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};

const auth = { session: async () => null, role: () => "admin" };

const runs = resource(
  { __name: "scraper_run" },
  {
    columns: ["id", "platform", "status"],
    filters: [{ field: "startedAt", type: "daterange" }],
    views: [{ name: "Errors", filters: { status: "error" } }],
  },
);
const users = resource(
  { __name: "user" },
  {
    columns: ["id", "email"],
    detail: {
      tabs: [
        {
          key: "responses",
          label: "Responses",
          resource: "response",
          filter: (u) => ({ userId: u.id }),
          hide: ["userId"],
          sort: { field: "sentAt", dir: "desc" },
        },
      ],
    },
  },
);
const responses = resource({ __name: "response" }, { columns: ["id", "userId", "sentAt"] });

function boot(widgets: WidgetConfig[], resources: AnyResourceConfig[] = [runs, users, responses]) {
  return () =>
    defineAdmin({
      adapter,
      auth,
      resources,
      dashboards: [dashboard({ path: "/system", label: "System", sections: [{ widgets }] })],
    });
}

const site = String.raw`dashboard "/system" sections\[0\]\.widgets\[0\]`;

describe("static links at defineAdmin", () => {
  it("accepts links, counts, views and tabs that all exist", () => {
    expect(
      boot([
        metric("Runs", async () => 1, {
          drilldown: {
            resource: "scraper_run",
            view: "Errors",
            filter: { platform: "kwork" },
            range: "startedAt",
          },
        }),
        metric("Pulse", async () => 1, { drilldown: { dashboard: "/system" } }),
        table({ resource: "user", seeAll: { resource: "user", id: "u1", tab: "responses" } }),
        kv({ items: [{ label: "Runs", value: 1, href: { resource: "scraper_run" } }] }),
        metric("Errors", { count: "scraper_run", where: { status: "error" }, range: "startedAt" }),
        metric("Later", async () => 1, {
          drilldown: () => ({ resource: "checked_when_rendered" }),
        }),
      ]),
    ).not.toThrow();
  });

  it("names a missing resource and the closest one", () => {
    expect(
      boot([metric("Runs", async () => 1, { drilldown: { resource: "scraper_rn" } })]),
    ).toThrow(
      new RegExp(
        `${site}\\.options\\.drilldown: it names resource "scraper_rn", which does not exist\\. Did you mean "scraper_run"\\?`,
      ),
    );
  });

  it("names a missing dashboard, view or tab", () => {
    expect(boot([metric("P", async () => 1, { drilldown: { dashboard: "/sytem" } })])).toThrow(
      /names dashboard "\/sytem", which does not exist\. Did you mean "\/system"\?/,
    );
    expect(
      boot([metric("R", async () => 1, { drilldown: { resource: "scraper_run", view: "Erors" } })]),
    ).toThrow(
      /names view "Erors" on "scraper_run", which does not exist\. Did you mean "Errors"\?/,
    );
    expect(
      boot([table({ resource: "user", seeAll: { resource: "user", id: "u1", tab: "respones" } })]),
    ).toThrow(/options\.seeAll: it names tab "respones" on "user".*Did you mean "responses"\?/);
    expect(
      boot([kv({ items: [{ label: "R", value: 1, href: { resource: "scraper_rn" } }] })]),
    ).toThrow(/options\.items\[0\]\.href: it names resource "scraper_rn"/);
  });

  it("names a filter that is not a column, or one the target's list would drop", () => {
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { platfrom: "kwork" } },
        }),
      ]),
    ).toThrow(
      /drilldown\.filter: it names column "platfrom" on "scraper_run".*Did you mean "platform"\?/,
    );
    expect(
      boot([
        metric("U", async () => 1, { drilldown: { resource: "user", filter: { createdAt: "x" } } }),
      ]),
    ).toThrow(/filters "user" by "createdAt", which its list does not declare/);
  });

  it("names a value the target's list would read as other rows", () => {
    expect(
      boot([metric("E", { count: "scraper_run", where: { status: ["error", "timeout"] } })]),
    ).toThrow(
      /\.where: it filters "scraper_run" by "status" = \["error","timeout"\], but the list reads "status" as plain text, and this value needs a "multiselect" filter there/,
    );
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { platform: { gte: 1 } } },
        }),
      ]),
    ).toThrow(/needs a "numeric-range" filter there/);
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { platform: { gte: new Date(0) } } },
        }),
      ]),
    ).toThrow(/needs a "daterange" filter there/);
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { startedAt: new Date(0) } },
        }),
      ]),
    ).toThrow(/a Date matches one instant while the list reads it as a day/);
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { startedAt: { gte: new Date(0) } } },
        }),
      ]),
    ).not.toThrow();
  });

  it("reads a by-name filter as text, and a single value on a range filter as an open bound", () => {
    const byName = resource(
      { __name: "scraper_run" },
      { columns: ["id"], filters: ["status", { field: "startedAt", type: "daterange" }] },
    );
    expect(
      boot(
        [metric("E", { count: "scraper_run", where: { status: ["error", "timeout"] } })],
        [byName, users, responses],
      ),
    ).toThrow(
      /the list reads "status" through a "text" filter, and this value needs a "multiselect" filter there/,
    );
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { startedAt: "2026-09-01" } },
        }),
      ]),
    ).toThrow(/through a "daterange" filter, which turns a single value into an open-ended bound/);
    expect(
      boot([
        metric("R", async () => 1, {
          drilldown: { resource: "scraper_run", filter: { startedAt: "last7d" } },
        }),
      ]),
    ).not.toThrow();
  });

  it("names a range that is not one of the target's daterange filters", () => {
    expect(
      boot([
        metric("R", async () => 1, { drilldown: { resource: "scraper_run", range: "startedAtt" } }),
      ]),
    ).toThrow(/names daterange filter "startedAtt" on "scraper_run".*Did you mean "startedAt"\?/);
  });

  it("checks what a count metric counts", () => {
    expect(boot([metric("E", { count: "scraper_rn" })])).toThrow(
      new RegExp(`${site}\\.count: it names resource "scraper_rn"`),
    );
    expect(boot([metric("E", { count: "scraper_run", where: { statuss: "error" } })])).toThrow(
      /\.where: it names column "statuss" on "scraper_run".*Did you mean "status"\?/,
    );
    expect(boot([metric("E", { count: "scraper_run", range: "platform" })])).toThrow(
      /\.range: it counts "scraper_run" rows by "platform".*no daterange filter on "platform".*its own drilldown/s,
    );
    expect(
      boot([metric("E", { count: "scraper_run", range: "platform" }, { drilldown: "/runs" })]),
    ).not.toThrow();
  });
});

describe("views and related tabs at defineAdmin", () => {
  it("names a view filter or sort field that is not a column", () => {
    const typo = resource(
      { __name: "scraper_run" },
      { columns: ["id", "status"], views: [{ name: "E", filters: { stauts: "error" } }] },
    );
    expect(boot([], [typo, users, responses])).toThrow(
      /resource "scraper_run" views\[0\]\.filters: it names column "stauts" on "scraper_run".*Did you mean "status"\?/,
    );
    const sorted = resource(
      { __name: "scraper_run" },
      { columns: ["id"], views: [{ name: "E", sort: { field: "startedAtt", dir: "desc" } }] },
    );
    expect(boot([], [sorted, users, responses])).toThrow(
      /views\[0\]\.sort\.field: it names column "startedAtt"/,
    );
  });

  it("names a view filter the list does not declare", () => {
    const hidden = resource(
      { __name: "scraper_run" },
      { columns: ["id"], views: [{ name: "Kwork", filters: { platform: "kwork" } }] },
    );
    expect(boot([], [hidden, users, responses])).toThrow(
      /filters "scraper_run" by "platform", which its list does not declare/,
    );
  });

  it("names a related tab's hide or sort field that is not a column of its target", () => {
    const tabbed = (hide: string[], field: string) =>
      resource(
        { __name: "user" },
        {
          columns: ["id"],
          detail: {
            tabs: [
              {
                key: "r",
                label: "R",
                resource: "response",
                hide,
                sort: { field, dir: "desc" as const },
              },
            ],
          },
        },
      );
    expect(boot([], [runs, tabbed(["usrId"], "sentAt"), responses])).toThrow(
      /resource "user" detail\.tabs\[0\]\.hide: it names column "usrId" on "response".*Did you mean "userId"\?/,
    );
    expect(boot([], [runs, tabbed([], "sentat"), responses])).toThrow(
      /detail\.tabs\[0\]\.sort\.field: it names column "sentat" on "response"/,
    );
  });

  it("checks the record page's strip and side column", () => {
    const carded = (detail: { stats?: Array<StatWidget | MetricWidget>; aside?: WidgetConfig[] }) =>
      resource({ __name: "user" }, { columns: ["id"], detail });
    expect(
      boot(
        [],
        [
          runs,
          carded({ stats: [metric("R", async () => 1, { drilldown: { dashboard: "/sytem" } })] }),
          responses,
        ],
      ),
    ).toThrow(
      /resource "user" detail\.stats\[0\]\.options\.drilldown: it names dashboard "\/sytem"/,
    );
    expect(
      boot([], [runs, carded({ stats: [metric("E", { count: "scraper_rn" })] }), responses]),
    ).toThrow(/resource "user" detail\.stats\[0\]\.count: it names resource "scraper_rn"/);
    expect(
      boot(
        [],
        [
          runs,
          carded({
            aside: [kv({ items: [{ label: "R", value: 1, href: { resource: "scraper_rn" } }] })],
          }),
          responses,
        ],
      ),
    ).toThrow(
      /resource "user" detail\.aside\[0\]\.options\.items\[0\]\.href: it names resource "scraper_rn"/,
    );
    expect(boot([], [runs, carded({ aside: [table({ resource: "nope" })] }), responses])).toThrow(
      /resource "user" detail\.aside.*: it points at resource "nope"/,
    );
  });

  it("checks nothing on a resource whose adapter reports no columns", () => {
    const ghost = resource(
      { __name: "ghost" },
      { columns: ["id"], views: [{ name: "Any", filters: { whatever: "x" } }] },
    );
    expect(boot([], [runs, users, responses, ghost])).not.toThrow();
  });
});
