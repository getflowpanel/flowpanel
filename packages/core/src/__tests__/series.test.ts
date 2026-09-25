import { describe, expect, it, vi } from "vitest";
import { fillDays, OTHER_KEY, previousRange, series } from "../runtime/series";

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

  it("buckets in the range's own zone when no timeZone is passed", () => {
    const rows = [{ day: new Date("2026-09-01T22:30:00Z"), n: 2 }];
    const moscow = {
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-02T12:00:00Z"),
      timeZone: "Europe/Moscow",
    };
    expect(fillDays(rows, moscow, { dateField: "day", valueField: "n" })).toEqual([
      { date: "2026-09-01", value: 0 },
      { date: "2026-09-02", value: 2 },
    ]);
  });
});

describe("series", () => {
  const moscowDays = {
    from: new Date("2026-09-20T21:00:00Z"),
    to: new Date("2026-09-22T20:59:59Z"),
    timeZone: "Europe/Moscow",
  };
  const orders = [
    { at: new Date("2026-09-20T21:30:00Z"), platform: "kwork", orders: 2 },
    { at: new Date("2026-09-21T20:59:00Z"), platform: "fl", orders: "3" },
    { at: new Date("2026-09-21T21:00:00Z"), platform: "kwork", orders: 5n },
  ];

  it("counts rows per day in the range's own zone", () => {
    expect(series(orders, moscowDays, { at: "at", grain: "day" })).toEqual([
      { date: "2026-09-21", value: 2 },
      { date: "2026-09-22", value: 1 },
    ]);
  });

  it("reads a zoneless timestamp as UTC, whatever the server's zone", () => {
    expect(series([{ at: "2026-09-21 21:30:00" }], moscowDays, { at: "at", grain: "day" })).toEqual(
      [
        { date: "2026-09-21", value: 0 },
        { date: "2026-09-22", value: 1 },
      ],
    );
  });

  it("starts a whole-history range at the first row's bucket", () => {
    const history = { from: new Date(0), to: new Date("2026-09-03T12:00:00Z") };
    const rows = [{ at: "2026-09-02 10:00:00" }, { at: "2026-09-01" }];
    expect(series(rows, history, { at: "at", grain: "day" })).toEqual([
      { date: "2026-09-01", value: 1 },
      { date: "2026-09-02", value: 1 },
      { date: "2026-09-03", value: 0 },
    ]);
    expect(series([], history, { at: "at" as never, grain: "day" })).toEqual([]);
  });

  it("sums booleans as 0 and 1, as fillDays always did", () => {
    const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-01T12:00:00Z") };
    const rows = [
      { day: "2026-09-01", ok: true },
      { day: "2026-09-01", ok: false },
    ];
    expect(fillDays(rows, range, { dateField: "day", valueField: "ok" })).toEqual([
      { date: "2026-09-01", value: 1 },
    ]);
  });

  it("pivots by a field, sums strings and bigints, and keeps every declared key", () => {
    expect(
      series(orders, moscowDays, {
        at: "at",
        by: "platform",
        value: "orders",
        grain: "day",
        keys: ["kwork", "fl", "weblancer"],
      }),
    ).toEqual([
      { date: "2026-09-21", kwork: 2, fl: 3, weblancer: 0 },
      { date: "2026-09-22", kwork: 5, fl: 0, weblancer: 0 },
    ]);
  });

  it("skips the hour the clocks jump over in Berlin", () => {
    const day = {
      from: new Date("2026-03-28T23:00:00Z"),
      to: new Date("2026-03-29T21:59:59Z"),
      timeZone: "Europe/Berlin",
    };
    const hours = series([], day, { at: "at" as never, grain: "hour" });
    expect(hours).toHaveLength(23);
    expect(hours.slice(0, 3).map((point) => point.date)).toEqual([
      "2026-03-29T00:00",
      "2026-03-29T01:00",
      "2026-03-29T03:00",
    ]);
  });

  it("folds the hour Berlin repeats into one bucket", () => {
    const day = {
      from: new Date("2026-10-24T22:00:00Z"),
      to: new Date("2026-10-25T22:59:59Z"),
      timeZone: "Europe/Berlin",
    };
    const rows = [
      { at: new Date("2026-10-25T00:30:00Z") },
      { at: new Date("2026-10-25T01:30:00Z") },
    ];
    const hours = series(rows, day, { at: "at", grain: "hour" });
    expect(hours).toHaveLength(24);
    expect(hours.find((point) => point.date === "2026-10-25T02:00")?.value).toBe(2);
  });

  it("rolls hours up into exactly the day totals across a DST week", () => {
    const week = {
      from: new Date("2026-03-26T12:00:00Z"),
      to: new Date("2026-04-01T12:00:00Z"),
      timeZone: "Europe/Berlin",
    };
    const rows = Array.from({ length: 500 }, (_, i) => ({
      at: new Date(week.from.getTime() + i * 1_037_000),
      n: i % 7,
    }));
    const byDay = new Map<string, number>();
    for (const point of series(rows, week, { at: "at", value: "n", grain: "hour" })) {
      const day = point.date.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + point.value);
    }
    const days = series(rows, week, { at: "at", value: "n", grain: "day" });
    expect(days.map((point) => [point.date, point.value])).toEqual(
      days.map((point) => [point.date, byDay.get(point.date)]),
    );
  });

  it("fills a gap with 0 for a count and with what a function returns for []", () => {
    const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-02T12:00:00Z") };
    const rows = [{ at: "2026-09-01", ok: 1 }];
    const share = (group: typeof rows) =>
      group.length === 0 ? null : group.filter((row) => row.ok === 1).length / group.length;
    expect(series(rows, range, { at: "at", grain: "day", value: share })).toEqual([
      { date: "2026-09-01", value: 1 },
      { date: "2026-09-02", value: null },
    ]);
  });

  it("keeps the largest series and folds the rest into OTHER_KEY", () => {
    const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-02T00:00:00Z") };
    const rows = [
      { at: "2026-09-01", p: "a" },
      { at: "2026-09-01", p: "a" },
      { at: "2026-09-01", p: "b" },
      { at: "2026-09-01", p: "c" },
      { at: "2026-09-02", p: "c" },
      { at: "2026-09-02", p: "c" },
    ];
    expect(series(rows, range, { at: "at", by: "p", grain: "day", top: 1 })).toEqual([
      { date: "2026-09-01", c: 1, [OTHER_KEY]: 3 },
      { date: "2026-09-02", c: 2, [OTHER_KEY]: 0 },
    ]);
  });

  it("keys weeks by their ISO Monday and months by their first day", () => {
    const rows = [{ d: "2026-09-02" }, { d: "2026-09-14" }];
    const weeks = { from: new Date("2026-08-31T00:00:00Z"), to: new Date("2026-09-20T00:00:00Z") };
    expect(series(rows, weeks, { at: "d", grain: "week" })).toEqual([
      { date: "2026-08-31", value: 1 },
      { date: "2026-09-07", value: 0 },
      { date: "2026-09-14", value: 1 },
    ]);
    const months = { from: new Date("2026-07-15T00:00:00Z"), to: new Date("2026-09-20T00:00:00Z") };
    expect(series(rows.slice(0, 1), months, { at: "d", grain: "month" })).toEqual([
      { date: "2026-07-01", value: 0 },
      { date: "2026-08-01", value: 0 },
      { date: "2026-09-01", value: 1 },
    ]);
  });

  it("picks hours, days, weeks or months from the range's length", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const after = (days: number) => ({ from, to: new Date(from.getTime() + days * 86_400_000) });
    expect(series([], after(2), { at: "at" as never })[0]?.date).toBe("2026-01-01T00:00");
    expect(series([], after(30), { at: "at" as never })[0]?.date).toBe("2026-01-01");
    expect(series([], after(200), { at: "at" as never })[1]?.date).toBe("2026-01-05");
    expect(series([], after(500), { at: "at" as never })[1]?.date).toBe("2026-02-01");
  });

  it("warns once in development when it folds more than 50,000 rows", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const range = { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-01T12:00:00Z") };
    const rows = Array.from({ length: 50_001 }, () => ({ at: "2026-09-01" }));
    series(rows, range, { at: "at", grain: "day" });
    series(rows, range, { at: "at", grain: "day" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("50,001 rows");
    warn.mockRestore();
  });
});
