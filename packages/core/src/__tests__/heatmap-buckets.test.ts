import { describe, expect, it } from "vitest";
import { dayStartIn, heatLevels, heatmapGrid, weekdayOf, weekStartOf } from "../index";

describe("heatmap buckets", () => {
  it("starts the week on the locale's first day", () => {
    expect(weekStartOf("ru-RU")).toBe(1);
    expect(weekStartOf("en-US")).toBe(7);
    expect(weekStartOf("not a locale")).toBe(1);
  });

  it("buckets instants by the zone's day across the end of DST", () => {
    const { weeks, total } = heatmapGrid(
      [
        { at: new Date("2026-10-24T22:30:00Z"), value: 1 },
        { at: new Date("2026-10-25T21:30:00Z"), value: 1 },
        { at: new Date("2026-10-25T23:30:00Z"), value: 1 },
      ],
      "2026-10-26",
      7,
      "Europe/Berlin",
      1,
    );
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells.map((cell) => [cell.day, cell.value])).toEqual([
      ["2026-10-20", 0],
      ["2026-10-21", 0],
      ["2026-10-22", 0],
      ["2026-10-23", 0],
      ["2026-10-24", 0],
      ["2026-10-25", 2],
      ["2026-10-26", 1],
    ]);
    expect(total).toBe(3);
  });

  it("pads the first and last week to whole weeks from the week's first day", () => {
    const sunday = heatmapGrid([], "2026-09-25", 7, "UTC", 7);
    expect(sunday.weeks).toHaveLength(2);
    expect(sunday.weeks[0]?.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(sunday.weeks[0]?.[6]?.day).toBe("2026-09-19");
    expect(weekdayOf("2026-09-19")).toBe(6);
    const monday = heatmapGrid([], "2026-09-27", 7, "UTC", 1);
    expect(monday.weeks).toHaveLength(1);
    expect(monday.weeks[0]?.[0]?.day).toBe("2026-09-21");
  });

  it("reads a YYYY-MM-DD day as that day, whatever the zone", () => {
    const { weeks } = heatmapGrid(
      [
        { at: "2026-09-25", value: 4 },
        { at: "2026-09-01", value: 9 },
      ],
      "2026-09-25",
      7,
      "Asia/Tokyo",
      1,
    );
    const cells = weeks.flat().filter((cell) => cell !== null);
    expect(cells.at(-1)).toMatchObject({ day: "2026-09-25", value: 4, level: 4 });
    expect(cells.reduce((sum, cell) => sum + cell.value, 0)).toBe(4);
  });

  it("steps values by quartile, the maximum always darkest", () => {
    expect([0, 0].map(heatLevels([0, 0]))).toEqual([0, 0]);
    expect([5].map(heatLevels([5]))).toEqual([4]);
    expect([1, 2, 3, 4].map(heatLevels([1, 2, 3, 4]))).toEqual([1, 2, 3, 4]);
    const tail = [1, 1, 1, 1, 1, 1, 1, 100];
    expect([1, 100].map(heatLevels(tail))).toEqual([1, 4]);
  });

  it("finds the instant a zone's day starts, across DST", () => {
    expect(dayStartIn("2026-10-25", "Europe/Berlin").toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(dayStartIn("2026-10-26", "Europe/Berlin").toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
    expect(dayStartIn("2026-09-25", "UTC").toISOString()).toBe("2026-09-25T00:00:00.000Z");
  });
});
