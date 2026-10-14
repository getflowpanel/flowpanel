import { describe, expect, it } from "vitest";
import { encodeFilters, encodeFilterValue } from "../internal";

describe("encodeFilterValue", () => {
  it("writes scalars as text and a date as its day in the zone", () => {
    expect(encodeFilterValue("paid", "UTC")).toBe("paid");
    expect(encodeFilterValue(3, "UTC")).toBe("3");
    expect(encodeFilterValue(false, "UTC")).toBe("false");
    expect(encodeFilterValue("last7d", "UTC")).toBe("last7d");
    expect(encodeFilterValue(new Date("2026-09-24T22:30:00Z"), "Europe/Moscow")).toBe("2026-09-25");
  });

  it("writes a range of dates as instants and a range of numbers as min:max", () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-08T00:00:00.000Z");
    expect(encodeFilterValue({ gte: from, lte: to }, "UTC")).toBe(
      "2026-09-01T00:00:00.000Z~2026-09-08T00:00:00.000Z",
    );
    expect(encodeFilterValue({ gte: from }, "UTC")).toBe("2026-09-01T00:00:00.000Z~");
    expect(encodeFilterValue({ op: "range", lte: to }, "UTC")).toBe("~2026-09-08T00:00:00.000Z");
    expect(encodeFilterValue({ gte: 7 }, "UTC")).toBe("7:");
    expect(encodeFilterValue({ gte: 1, lte: 5 }, "UTC")).toBe("1:5");
  });

  it("writes a set as a comma list", () => {
    expect(encodeFilterValue(["starter", "pro"], "UTC")).toBe("starter,pro");
    expect(encodeFilterValue({ op: "in", values: ["a", "b"] }, "UTC")).toBe("a,b");
  });

  it("skips a value that filters nothing", () => {
    expect(encodeFilterValue(undefined, "UTC")).toBeNull();
    expect(encodeFilterValue(null, "UTC")).toBeNull();
    expect(encodeFilterValue([], "UTC")).toBeNull();
    expect(encodeFilterValue({}, "UTC")).toBeNull();
  });

  it("throws on an object with no URL form instead of writing [object Object]", () => {
    expect(() => encodeFilterValue({ between: [1, 2] }, "UTC")).toThrow(
      /filter value \{"between":\[1,2\]\} has no URL form/,
    );
  });
});

describe("encodeFilters", () => {
  it("keeps only the fields that filter something", () => {
    expect(
      encodeFilters(
        { plan: ["starter", "pro"], daysSinceSeen: { gte: 7 }, gone: undefined },
        "UTC",
      ),
    ).toEqual({
      plan: "starter,pro",
      daysSinceSeen: "7:",
    });
    expect(encodeFilters(undefined, "UTC")).toEqual({});
  });

  it("writes null as an empty value, which keeps a filter's default off", () => {
    expect(encodeFilters({ isTest: null, plan: "pro" }, "UTC")).toEqual({
      isTest: "",
      plan: "pro",
    });
  });
});

describe("a money column's bounds", () => {
  const cents = new Map([["amount", 100]]);
  const fils = new Map([["amount", 1000]]);

  it("divide into the amount the list shows, negatives and every numeric type included", () => {
    expect(encodeFilters({ amount: { gte: -12345, lte: 5 } }, "UTC", cents)).toEqual({
      amount: "-123.45:0.05",
    });
    expect(encodeFilters({ amount: { gte: 100000n } }, "UTC", cents)).toEqual({
      amount: "1000:",
    });
    expect(encodeFilters({ amount: { lte: "250" } }, "UTC", cents)).toEqual({ amount: ":2.5" });
    expect(encodeFilters({ amount: { gte: 1005, lte: -1 } }, "UTC", fils)).toEqual({
      amount: "1.005:-0.001",
    });
  });

  it("stay as they are with no factor, minorUnits 0, or a value that is not a number", () => {
    expect(encodeFilters({ amount: { gte: 1500 } }, "UTC", new Map([["amount", 1]]))).toEqual({
      amount: "1500:",
    });
    expect(encodeFilters({ amount: { gte: "abc" } }, "UTC", cents)).toEqual({ amount: "abc:" });
  });
});
