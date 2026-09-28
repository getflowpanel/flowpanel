import { describe, expect, it } from "vitest";
import { assertColumn, normalizeWhere, whereValue, withRange } from "../index";

const columns = ["id", "userId", "status", "total", "createdAt"];
const call = 'ctx.read("order")';

describe("whereValue", () => {
  it("turns { gte, lte } into a range and an array into a set", () => {
    const at = new Date("2026-09-01T00:00:00Z");
    expect(whereValue({ gte: 10 })).toEqual({ op: "range", gte: 10 });
    expect(whereValue({ gte: at, lte: at })).toEqual({ op: "range", gte: at, lte: at });
    expect(whereValue(["paid", 3])).toEqual({ op: "in", values: ["paid", "3"] });
  });

  it("keeps plain values, sentinels and already structured values", () => {
    const at = new Date(0);
    expect(whereValue("paid")).toBe("paid");
    expect(whereValue(at)).toBe(at);
    expect(whereValue("__notnull__")).toBe("__notnull__");
    expect(whereValue({ op: "in", values: ["a"] })).toEqual({ op: "in", values: ["a"] });
  });
});

describe("normalizeWhere", () => {
  it("returns the adapter's filter map", () => {
    expect(normalizeWhere(call, { userId: "u1", total: { lte: 5 } }, columns)).toEqual({
      userId: "u1",
      total: { op: "range", lte: 5 },
    });
  });

  it("throws on a field that is not a column and names the closest one", () => {
    expect(() => normalizeWhere(call, { usrId: "u1" }, columns)).toThrow(
      /ctx\.read\("order"\) filters by "usrId", but the adapter reports no such column on that resource\. Did you mean "userId"\?/,
    );
  });

  it("throws on undefined, null, an empty string and an open range instead of matching every row", () => {
    expect(() => normalizeWhere(call, { userId: undefined }, columns)).toThrow(
      /filters "userId" by undefined, which would match every row/,
    );
    expect(() => normalizeWhere(call, { userId: null }, columns)).toThrow(/by null/);
    expect(() => normalizeWhere(call, { status: "" }, columns)).toThrow(/by "", which would match/);
    expect(() => normalizeWhere(call, { total: {} }, columns)).toThrow(/by an open range/);
    expect(() => normalizeWhere(call, { total: { op: "range" } }, columns)).toThrow(
      /by an open range/,
    );
  });

  it("throws on an array holding a boolean instead of comparing it as text", () => {
    expect(() => normalizeWhere(call, { status: [false] }, columns)).toThrow(
      /filters "status" by an array that holds a boolean.*Pass true or false as a plain value/,
    );
    expect(() => normalizeWhere(call, { status: ["paid", true] }, columns)).toThrow(
      /array that holds a boolean/,
    );
  });

  it("answers null for an empty set, which no row can match", () => {
    expect(normalizeWhere(call, { status: [] }, columns)).toBeNull();
    expect(normalizeWhere(call, { status: { op: "in", values: [] } }, columns)).toBeNull();
  });

  it("checks nothing when the adapter reports no columns", () => {
    expect(normalizeWhere(call, { anything: 1 }, [])).toEqual({ anything: 1 });
  });
});

describe("assertColumn", () => {
  it("words the verb it is given", () => {
    expect(() => assertColumn(call, "creatdAt", columns, "sorts by")).toThrow(
      /sorts by "creatdAt".*Did you mean "createdAt"\?/,
    );
  });
});

describe("withRange", () => {
  const week = { from: new Date("2026-09-14T00:00:00Z"), to: new Date("2026-09-21T00:00:00Z") };
  const count = 'ctx.count("order")';

  it("bounds the field by the widget's range, inclusive", () => {
    expect(withRange(count, { status: "paid" }, "createdAt", week, columns)).toEqual({
      status: "paid",
      createdAt: { op: "range", gte: week.from, lte: week.to },
    });
  });

  it("adds nothing without a field or over a whole history", () => {
    expect(withRange(count, { status: "paid" }, undefined, week, columns)).toEqual({
      status: "paid",
    });
    const history = { from: new Date(0), to: week.to };
    expect(withRange(count, {}, "createdAt", history, columns)).toEqual({});
  });

  it("narrows a range the where already puts on the field to the overlap", () => {
    const since = new Date("2026-09-17T00:00:00Z");
    expect(
      withRange(count, { createdAt: { op: "range", gte: since } }, "createdAt", week, columns),
    ).toEqual({ createdAt: { op: "range", gte: since, lte: week.to } });
    const until = new Date("2026-09-10T00:00:00Z");
    expect(
      withRange(count, { createdAt: { op: "range", lte: until } }, "createdAt", week, columns),
    ).toEqual({ createdAt: { op: "range", gte: week.from, lte: until } });
  });

  it("throws on a field that is not a column, or one the where sets to a value that is not a range", () => {
    expect(() => withRange(count, {}, "creatdAt", week, columns)).toThrow(
      /ctx\.count\("order"\) ranges "creatdAt".*Did you mean "createdAt"\?/s,
    );
    expect(() =>
      withRange(count, { createdAt: "__notnull__" }, "createdAt", week, columns),
    ).toThrow(
      /sets where\.createdAt to a value that is not a range and range: "createdAt"\. Keep one\./,
    );
  });
});
