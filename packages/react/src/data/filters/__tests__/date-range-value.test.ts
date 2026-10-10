import { describe, expect, it } from "vitest";
import { toISODate } from "../../Calendar";
import { parseDateRangeValue, serializeDateRange } from "../date-range-value";

describe("date range filter values", () => {
  it("reads a from~to instant pair as its days in the admin's zone", () => {
    const range = parseDateRangeValue(
      "2026-09-22T21:00:00.000Z~2026-09-23T07:00:00.000Z",
      "Europe/Moscow",
    );
    expect(range.from && toISODate(range.from)).toBe("2026-09-23");
    expect(range.to && toISODate(range.to)).toBe("2026-09-23");
  });

  it("reads and writes plain days as before", () => {
    expect(serializeDateRange(parseDateRangeValue("2026-08-05:2026-08-20", "UTC"))).toBe(
      "2026-08-05:2026-08-20",
    );
  });
});
