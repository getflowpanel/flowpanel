import { describe, expect, it } from "vitest";
import { filterConditions, searchedFields } from "../internal/filter-walk";

describe("filterConditions", () => {
  it("decodes every filter shape and drops empty ones", () => {
    expect(
      filterConditions({
        a: "x",
        b: "__null__",
        c: "__notnull__",
        d: { op: "range", gte: 1 },
        e: { op: "range" },
        f: { op: "in", values: ["p", "q"] },
        g: { op: "in", values: [] },
        h: "",
        i: null,
        j: undefined,
      }),
    ).toEqual([
      { op: "eq", field: "a", value: "x" },
      { op: "isNull", field: "b" },
      { op: "notNull", field: "c" },
      { op: "range", field: "d", gte: 1 },
      { op: "in", field: "f", values: ["p", "q"] },
    ]);
  });

  it("skips fields the adapter does not know", () => {
    expect(filterConditions({ a: 1, ghost: 2 }, (field) => field === "a")).toEqual([
      { op: "eq", field: "a", value: 1 },
    ]);
  });
});

describe("searchedFields", () => {
  it("keeps the declared text fields only when there is a term", () => {
    const isText = (field: string) => field !== "age";
    expect(searchedFields("ann", ["name", "age"], isText)).toEqual(["name"]);
    expect(searchedFields("", ["name"], isText)).toEqual([]);
    expect(searchedFields("ann", undefined, isText)).toEqual([]);
  });
});
