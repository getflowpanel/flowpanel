import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDateRangePreset } from "../runtime/date-range";
import { sanitizeFilterValues } from "../runtime/parse-list-params";

const createdAt = [{ field: "createdAt", type: "daterange" as const }];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a preset name in a daterange filter", () => {
  it("reads last7d as the seven days before now", () => {
    expect(sanitizeFilterValues({ createdAt: "last7d" }, createdAt, "Europe/Moscow")).toEqual({
      createdAt: {
        op: "range",
        gte: new Date("2026-09-18T09:00:00Z"),
        lte: new Date("2026-09-25T09:00:00Z"),
      },
    });
  });

  it("reads today from midnight in the admin's zone", () => {
    expect(sanitizeFilterValues({ createdAt: "today" }, createdAt, "Europe/Moscow")).toEqual({
      createdAt: {
        op: "range",
        gte: new Date("2026-09-24T21:00:00Z"),
        lte: new Date("2026-09-25T09:00:00Z"),
      },
    });
  });

  it("knows exactly the dashboard presets", () => {
    expect(
      ["today", "yesterday", "last7d", "last30d", "MTD", "QTD", "YTD"].every(isDateRangePreset),
    ).toBe(true);
    expect(isDateRangePreset("last90d")).toBe(false);
  });
});
