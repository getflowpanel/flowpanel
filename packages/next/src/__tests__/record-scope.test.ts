import type { Adapter, ColumnMeta } from "@flowpanel/core";
import { defineAdmin, resource } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { bindViewedRecord, scopeToRecord } from "../runtime/record-scope";
import { fakeWidgetContext } from "./widget-context-fixture";

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
  introspect: (ref) => ({
    name: (ref as { __name: string }).__name,
    columns: ["id", "userId", "reviewerId", "value"].map(meta),
    primaryKey: "id",
  }),
  inferSchema: () => ({}) as never,
  list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => null,
  create: async () => ({}),
  update: async () => ({}),
  delete: async () => undefined,
};
const toUser = { resource: "users", labelField: "id" };
const config = defineAdmin({
  adapter,
  auth: { session: async () => null, role: () => "admin" },
  resources: [
    resource({ __name: "users" }, { columns: ["id"] }),
    resource({ __name: "scores" }, { columns: ["id", { field: "userId", reference: toUser }] }),
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
    resource({ __name: "notes" }, { columns: ["id", "userId"] }),
  ],
});

describe("scopeToRecord", () => {
  const card = fakeWidgetContext();
  bindViewedRecord(card, "users", "u1");

  it("ANDs the one referencing field with the record's key", () => {
    expect(scopeToRecord(config, card, "scores", { value: "1" }, "site", true)).toEqual({
      value: "1",
      userId: "u1",
    });
  });

  it("keeps a count metric's where that already names a referencing field", () => {
    expect(scopeToRecord(config, card, "scores", { userId: "u2" }, "metric", false)).toEqual({
      userId: "u2",
    });
  });

  it("sets a source's record filter over a where that names the field, and follows by", () => {
    expect(
      scopeToRecord(config, card, "scores", { userId: "__notnull__" }, "timeline source", true),
    ).toEqual({ userId: "u1" });
    expect(
      scopeToRecord(
        config,
        card,
        "responses",
        { value: "1" },
        "timeline source",
        true,
        "reviewerId",
      ),
    ).toEqual({ value: "1", reviewerId: "u1" });
  });

  it("throws on several referencing fields", () => {
    expect(() => scopeToRecord(config, card, "responses", {}, "metric", false)).toThrow(
      '[flowpanel] metric: it reads "responses" on a "users" card, and several of its columns ' +
        'point at a "users" (userId, reviewerId). Name one in where.',
    );
    expect(() =>
      scopeToRecord(
        config,
        card,
        "responses",
        { reviewerId: "__notnull__" },
        "timeline source",
        true,
      ),
    ).toThrow(
      '[flowpanel] timeline source: it reads "responses" on a "users" card, and several of its ' +
        'columns point at a "users" (userId, reviewerId). Pass by.',
    );
  });

  it("counts unscoped, or throws, when nothing references the record", () => {
    expect(scopeToRecord(config, card, "notes", {}, "metric", false)).toEqual({});
    expect(() => scopeToRecord(config, card, "notes", {}, "heatmap source", true)).toThrow(
      '[flowpanel] heatmap source: it reads "notes" on a "users" card, but none of its columns ' +
        'declares reference: { resource: "users" }, so it would read every row. Pass by, or add the reference.',
    );
  });

  it("leaves a dashboard's where alone", () => {
    expect(scopeToRecord(config, fakeWidgetContext(), "scores", {}, "site", true)).toEqual({});
  });
});
