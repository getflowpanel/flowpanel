import { describe, expect, it } from "vitest";
import { fillDays, previousRange } from "../runtime/series";

describe("previousRange", () => {
  it("returns the seven days before a seven-day range", () => {
    const range = { from: new Date("2026-09-14T00:00:00Z"), to: new Date("2026-09-21T00:00:00Z") };
    const previous = previousRange(range);
    expect(previous.from.toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("shifts by elapsed time, so a DST week's comparison moves an hour", () => {
    const range = { from: new Date("2026-03-08T05:00:00Z"), to: new Date("2026-03-15T04:00:00Z") };
    const previous = previousRange(range);
    expect(previous.from.toISOString()).toBe("2026-03-01T06:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });

  it("keeps the span of an uneven range", () => {
    const range = { from: new Date("2026-09-20T09:30:00Z"), to: new Date("2026-09-20T15:30:00Z") };
    const previous = previousRange(range);
    expect(previous.to.getTime() - previous.from.getTime()).toBe(6 * 60 * 60 * 1000);
    expect(previous.to.toISOString()).toBe("2026-09-20T09:30:00.000Z");
  });
});

describe("fillDays", () => {
  const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-04T00:00:00Z") };

  it("zero-fills the days the query returned no row for", () => {
    const rows = [
      { day: "2026-09-01", total: 3 },
      { day: "2026-09-04", total: 5 },
    ];
    expect(fillDays(rows, range, { dateField: "day", valueField: "total" })).toEqual([
      { date: "2026-09-01", value: 3 },
      { date: "2026-09-02", value: 0 },
      { date: "2026-09-03", value: 0 },
      { date: "2026-09-04", value: 5 },
    ]);
  });

  it("buckets a timestamp into the requested zone's day, not UTC's", () => {
    const rows = [{ at: new Date("2026-09-02T02:00:00Z"), total: 7 }];
    const utc = fillDays(rows, range, { dateField: "at", valueField: "total" });
    expect(utc.find((d) => d.date === "2026-09-02")?.value).toBe(7);

    const newYork = fillDays(rows, range, {
      dateField: "at",
      valueField: "total",
      timeZone: "America/New_York",
    });
    expect(newYork.find((d) => d.date === "2026-09-01")?.value).toBe(7);
    expect(newYork.find((d) => d.date === "2026-09-02")?.value).toBe(0);
  });

  it("sums several rows landing on the same day and reads numeric strings", () => {
    const rows = [
      { day: "2026-09-03", total: "2" },
      { day: "2026-09-03", total: 4 },
    ];
    const filled = fillDays(rows, range, { dateField: "day", valueField: "total" });
    expect(filled.find((d) => d.date === "2026-09-03")?.value).toBe(6);
  });

  it("gives one bucket per calendar day the range touches, both ends included", () => {
    const to = new Date("2026-09-20T09:00:00Z");
    const last7d = { from: new Date(to.getTime() - 7 * 86_400_000), to };
    const filled = fillDays([], last7d, { dateField: "day", valueField: "total" });
    expect(filled).toHaveLength(8);
    expect(filled[0]?.date).toBe("2026-09-13");
    expect(filled.at(-1)?.date).toBe("2026-09-20");
  });

  it("ignores a row whose date field holds nothing usable", () => {
    const rows = [{ day: null, total: 9 }];
    const filled = fillDays(rows, range, { dateField: "day", valueField: "total" });
    expect(filled.every((d) => d.value === 0)).toBe(true);
    expect(filled).toHaveLength(4);
  });
});
