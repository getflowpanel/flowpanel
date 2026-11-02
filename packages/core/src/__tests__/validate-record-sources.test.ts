import { describe, expect, it } from "vitest";
import {
  type Adapter,
  type ColumnMeta,
  dashboard,
  defineAdmin,
  heatmap,
  resource,
  type TimelineSource,
  timeline,
} from "../index";

const COLUMNS: Record<string, string[]> = {
  users: ["id", "name"],
  visits: ["id", "userId", "startedAt"],
  responses: ["id", "userId", "reviewerId", "sentAt"],
  notes: ["id", "userId", "at"],
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
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};
const toUser = { resource: "users", labelField: "name" };
const others = [
  resource(
    { __name: "visits" },
    { columns: ["id", { field: "userId", reference: toUser }, "startedAt"] },
  ),
  resource(
    { __name: "responses" },
    {
      columns: [
        "id",
        { field: "userId", reference: toUser },
        { field: "reviewerId", reference: toUser },
        "sentAt",
      ],
    },
  ),
  resource({ __name: "notes" }, { columns: ["id", "userId", "at"] }),
];

function onCard(source: TimelineSource) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource(
        { __name: "users" },
        {
          columns: ["id", "name"],
          detail: {
            tabs: [
              {
                key: "activity",
                label: "Activity",
                widgets: [timeline({ kinds: { visit: "Visit" }, sources: [source] })],
              },
            ],
          },
        },
      ),
      ...others,
    ],
  });
}

const site = 'resource "users" detail.tabs[0].widgets[0].options.sources[0]';

describe("timeline sources at defineAdmin", () => {
  it("names a resource, a timestamp or a kind that does not exist", () => {
    expect(() => onCard({ resource: "vists", kind: "visit", at: "startedAt" })).toThrow(
      /names resource "vists", which does not exist\. Did you mean "visits"\?/,
    );
    expect(() => onCard({ resource: "visits", kind: "visit", at: "startedat" })).toThrow(
      `[flowpanel] ${site}.at: it names column "startedat" on "visits", which does not exist. Did you mean "startedAt"?`,
    );
    expect(() => onCard({ resource: "visits", kind: "vist", at: "startedAt" })).toThrow(
      /\.kind: it names kind "vist", which does not exist\. Did you mean "visit"\?/,
    );
  });

  it("needs a declared reference behind every ref", () => {
    expect(() =>
      onCard({ resource: "visits", kind: "visit", at: "startedAt", refs: ["startedAt"] }),
    ).toThrow(
      `[flowpanel] ${site}.refs: "startedAt" is not a reference column of "visits". Declare reference on that column.`,
    );
  });

  it("needs one field that points at the record, or by, and never lets where set it", () => {
    expect(() => onCard({ resource: "notes", kind: "visit", at: "at" })).toThrow(
      `[flowpanel] ${site}: it reads "notes" on a "users" card, but none of its columns declares ` +
        'reference: { resource: "users" }, so it would read every row. Pass by, or add the reference.',
    );
    expect(() => onCard({ resource: "responses", kind: "visit", at: "sentAt" })).toThrow(
      /several of its columns point at a "users" \(userId, reviewerId\)\. Pass by\./,
    );
    expect(() =>
      onCard({
        resource: "responses",
        kind: "visit",
        at: "sentAt",
        where: { reviewerId: "__notnull__" },
      }),
    ).toThrow(/several of its columns point at a "users" \(userId, reviewerId\)\. Pass by\./);
    expect(() =>
      onCard({ resource: "responses", kind: "visit", at: "sentAt", by: "reviewerId" }),
    ).not.toThrow();
    expect(() =>
      onCard({
        resource: "responses",
        kind: "visit",
        at: "sentAt",
        by: "reviewerId",
        where: { reviewerId: "__notnull__" },
      }),
    ).toThrow(
      `[flowpanel] ${site}.where: it sets reviewerId, which the record page fills in. Remove reviewerId from where.`,
    );
    expect(() =>
      onCard({
        resource: "visits",
        kind: "visit",
        at: "startedAt",
        where: { userId: "__notnull__" },
      }),
    ).toThrow(
      `[flowpanel] ${site}.where: it sets userId, which the record page fills in. Remove userId from where.`,
    );
    expect(() =>
      onCard({ resource: "responses", kind: "visit", at: "sentAt", by: "sentAt" }),
    ).toThrow(
      `[flowpanel] ${site}.by: "sentAt" does not declare reference: { resource: "users" } on "responses". Name a column that does.`,
    );
  });

  it("lets a dashboard source read without where", () => {
    expect(() =>
      defineAdmin({
        adapter,
        auth: { session: async () => null, role: () => "admin" },
        resources: [resource({ __name: "users" }, { columns: ["id", "name"] }), ...others],
        dashboards: [
          dashboard({
            path: "/pulse",
            label: "Pulse",
            sections: [
              {
                widgets: [
                  timeline({
                    kinds: { visit: "Visit" },
                    sources: [timeline.source("notes", { kind: "visit", at: "at" })],
                  }),
                ],
              },
            ],
          }),
        ],
      }),
    ).not.toThrow();
  });
});

describe("heatmap sources at defineAdmin", () => {
  const withHeatmap = (widget: ReturnType<typeof heatmap>) =>
    defineAdmin({
      adapter,
      auth: { session: async () => null, role: () => "admin" },
      resources: [
        resource({ __name: "users" }, { columns: ["id", "name"], detail: { aside: [widget] } }),
        ...others,
      ],
    });

  it("checks the source's fields and that one field points at the record", () => {
    expect(() => withHeatmap(heatmap({ source: { resource: "visits", at: "startedat" } }))).toThrow(
      /names column "startedat" on "visits".* Did you mean "startedAt"\?/,
    );
    expect(() => withHeatmap(heatmap({ source: { resource: "notes", at: "at" } }))).toThrow(
      /reads "notes" on a "users" card, but none of its columns declares reference/,
    );
    expect(() =>
      withHeatmap(heatmap({ source: { resource: "visits", at: "startedAt" } })),
    ).not.toThrow();
  });

  it("never lets where set the field that points at the record", () => {
    expect(() =>
      withHeatmap(
        heatmap({
          source: { resource: "responses", at: "sentAt", where: { reviewerId: "__notnull__" } },
        }),
      ),
    ).toThrow(/\(userId, reviewerId\)\. Pass by\./);
    expect(() =>
      withHeatmap(
        heatmap({
          source: {
            resource: "responses",
            at: "sentAt",
            by: "reviewerId",
            where: { reviewerId: "__notnull__" },
          },
        }),
      ),
    ).toThrow(
      /where: it sets reviewerId, which the record page fills in\. Remove reviewerId from where\./,
    );
    expect(() =>
      withHeatmap(heatmap({ source: { resource: "responses", at: "sentAt", by: "reviewerId" } })),
    ).not.toThrow();
  });

  it("needs a source or a query", () => {
    expect(() => withHeatmap(heatmap({}))).toThrow(
      '[flowpanel] resource "users" detail.aside[0]: the heatmap has neither source nor query. Give it one of them.',
    );
  });
});
