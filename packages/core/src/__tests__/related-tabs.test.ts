import { describe, expect, it } from "vitest";
import {
  type Adapter,
  type ColumnMeta,
  type DetailTab,
  defineAdmin,
  related,
  resource,
  table,
} from "../index";

type Row = Record<string, unknown>;

const meta = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: true,
  unique: false,
  primaryKey: name === "id",
});

const COLUMNS: Record<string, string[]> = {
  users: ["id", "email"],
  scores: ["id", "userId", "value"],
  responses: ["id", "userId", "reviewerId"],
  notes: ["id", "userId", "body"],
};

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

const toUser = { resource: "users", labelField: "email" };

function admin(tabs: DetailTab<Row>[]) {
  return defineAdmin({
    adapter,
    auth: { session: async () => null, role: () => "admin" },
    resources: [
      resource({ __name: "users" }, { columns: ["id", "email"], detail: { tabs } }),
      resource(
        { __name: "scores" },
        { plural: "Scores", columns: ["id", { field: "userId", reference: toUser }, "value"] },
      ),
      resource(
        { __name: "responses" },
        {
          columns: [
            "id",
            { field: "userId", reference: toUser },
            { field: "reviewerId", reference: toUser },
          ],
        },
      ),
      resource({ __name: "notes" }, { columns: ["id", "userId", "body"] }),
    ],
  });
}

const tabsOf = (config: ReturnType<typeof admin>) =>
  (config.resourcesByName.get("users")?.options.detail?.tabs ?? []) as DetailTab<Row>[];

describe("related tabs at defineAdmin", () => {
  it("infers by from the one column that references the record", () => {
    const [tab] = tabsOf(admin([related("scores")]));
    expect(tab).toMatchObject({
      key: "scores",
      label: "Scores",
      resource: "scores",
      by: "userId",
      hide: ["userId"],
      count: true,
    });
    expect(tab?.filter?.({ id: "u1" })).toEqual({ userId: "u1" });
  });

  it("asks for by when no column references the record", () => {
    expect(() => admin([related("notes")])).toThrow(
      'flowpanel: resource "users" tab "notes" reads "notes" on a "users" card, but none of its ' +
        'columns declares reference: { resource: "users" }, so it would read every row. Pass by, ' +
        "or add the reference.",
    );
  });

  it("asks for by when several columns reference the record", () => {
    expect(() => admin([related("responses")])).toThrow(
      'flowpanel: resource "users" tab "responses" reads "responses" on a "users" card, and ' +
        'several of its columns point at a "users" (userId, reviewerId); pass by.',
    );
  });

  it("takes a given by and label", () => {
    const [tab] = tabsOf(admin([related("responses", { by: "reviewerId", label: "Reviewed" })]));
    expect(tab).toMatchObject({ label: "Reviewed", by: "reviewerId", hide: ["reviewerId"] });
    expect(tab?.filter?.({ id: "u1" })).toEqual({ reviewerId: "u1" });
  });

  it("keeps a label set on a spread related tab", () => {
    const [tab] = tabsOf(admin([{ ...related("scores"), label: "Points" }]));
    expect(tab).toMatchObject({ label: "Points", by: "userId" });
  });

  it("lets an explicit filter win over by", () => {
    const [tab] = tabsOf(
      admin([
        { key: "s", label: "S", resource: "scores", by: "userId", filter: () => ({ value: "10" }) },
      ]),
    );
    expect(tab?.filter?.({ id: "u1" })).toEqual({ value: "10" });
    expect(tab?.hide).toEqual(["userId"]);
  });

  it("leaves a plain tab without by or filter as it was", () => {
    const plain = { key: "n", label: "N", resource: "notes" };
    const [tab] = tabsOf(admin([plain]));
    expect(tab).toBe(plain);
  });

  it("names a by that is not a column of the target", () => {
    expect(() => admin([related("scores", { by: "usrId" as never })])).toThrow(
      /detail\.tabs\[0\]\.by names column "usrId" on "scores".* Did you mean "userId"\?/,
    );
  });

  it("checks a resource table's where and range, and refuses them on a query table", () => {
    const tab = (widget: ReturnType<typeof table>): DetailTab<Row> => ({
      key: "w",
      label: "W",
      widgets: [widget],
    });
    expect(() => admin([tab(table({ resource: "scores", where: { usrId: "u1" } }))])).toThrow(
      /options\.where names column "usrId" on "scores".* Did you mean "userId"\?/,
    );
    expect(() => admin([tab(table({ resource: "scores", range: "createdAt" }))])).toThrow(
      /options\.range names column "createdAt" on "scores"/,
    );
    expect(() => admin([tab(table({ query: async () => [], where: { a: 1 } }))])).toThrow(
      "sets where or range, which narrow a resource read; a query table filters its own rows.",
    );
  });
});
