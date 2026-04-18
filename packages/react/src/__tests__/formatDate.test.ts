import { describe, expect, it } from "vitest";
import { formatDate } from "../utils/formatDate";

describe("formatDate", () => {
  it("date-relative returns 'just now' for recent dates", () => {
    expect(formatDate(new Date(), "date-relative", "UTC")).toBe("just now");
  });

  it("date-relative returns minutes for < 1h", () => {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
    expect(formatDate(thirtyMinAgo, "date-relative", "UTC")).toBe("30m ago");
  });

  it("date-relative returns hours for < 24h", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
    expect(formatDate(twoHoursAgo, "date-relative", "UTC")).toBe("2h ago");
  });

  it("accepts string input", () => {
    expect(() => formatDate("2026-04-10T12:00:00Z", "datetime", "UTC")).not.toThrow();
  });
});
