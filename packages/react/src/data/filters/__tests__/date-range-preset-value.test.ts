import { describe, expect, it } from "vitest";
import { parseDateRangeValue } from "../date-range-value";

describe("a preset name in a date filter value", () => {
  it("leaves the picker's range empty, whether or not the server resolves the name", () => {
    expect(parseDateRangeValue("last7d", "UTC")).toEqual({ from: null, to: null });
    expect(parseDateRangeValue("thisMonth", "UTC")).toEqual({ from: null, to: null });
  });
});
