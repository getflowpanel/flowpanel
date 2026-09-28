import { describe, expect, it, vi } from "vitest";
import { trackerRows, trackerWindow, worstTone } from "../runtime/tracker-rows";

const now = Date.parse("2026-09-21T09:30:00Z");
const ERR = { warn: 0.3, err: 0.5, min: 20 };
type Hour = { at: Date; platform: string; runs: number; failed: number };
const hours: Hour[] = [
  { at: new Date("2026-09-21T08:10:00Z"), platform: "kwork", runs: 30, failed: 20 },
  { at: new Date("2026-09-21T09:05:00Z"), platform: "kwork", runs: 10, failed: 1 },
  { at: new Date("2026-09-21T07:05:00Z"), platform: "fl", runs: 40, failed: 2 },
];
const errorRate = (rows: Hour[]) => {
  const runs = rows.reduce((sum, row) => sum + row.runs, 0);
  return runs === 0 ? null : rows.reduce((sum, row) => sum + row.failed, 0) / runs;
};

describe("trackerWindow", () => {
  it("ends with the current hour, in whole hours, in the admin's zone", () => {
    expect(trackerWindow(undefined, now, "Europe/Moscow")).toEqual({
      from: new Date("2026-09-20T10:00:00Z"),
      to: new Date(now),
      timeZone: "Europe/Moscow",
      grain: "hour",
    });
  });

  it("switches to whole days past 48 hours", () => {
    expect(trackerWindow("7d", now, "Europe/Moscow")).toMatchObject({
      from: new Date("2026-09-14T21:00:00Z"),
      grain: "day",
    });
    expect(trackerWindow("2d", now, "UTC")).toMatchObject({
      from: new Date("2026-09-19T10:00:00Z"),
      grain: "hour",
    });
  });

  it("falls back to 24 hours on a malformed window, and says so once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(trackerWindow("1.5d", now, "Europe/Moscow").from).toEqual(
      new Date("2026-09-20T10:00:00Z"),
    );
    trackerWindow("1.5d", now, "Europe/Moscow");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"1.5d"');
    warn.mockRestore();
  });
});

describe("trackerRows", () => {
  const window = trackerWindow("24h", now, "Europe/Moscow");
  const rows = trackerRows(
    hours,
    {
      at: "at",
      by: "platform",
      keys: ["kwork", "fl", "habr"],
      labels: { kwork: "Kwork", fl: "FL.ru" },
      value: errorRate,
      volume: "runs",
      tones: ERR,
    },
    window,
  );

  it("has one row per key and one block per hour of the window", () => {
    expect(rows.map((row) => [row.key, row.label, row.cells.length])).toEqual([
      ["kwork", "Kwork", 24],
      ["fl", "FL.ru", 24],
      ["habr", "habr", 24],
    ]);
  });

  it("tones each block by its value, muting too few runs", () => {
    const kwork = rows[0]?.cells.slice(-2);
    expect(
      kwork?.map((cell) => [cell.start.toISOString(), cell.value, cell.volume, cell.tone]),
    ).toEqual([
      ["2026-09-21T08:00:00.000Z", 20 / 30, 30, "err"],
      ["2026-09-21T09:00:00.000Z", 0.1, 10, "muted"],
    ]);
  });

  it("gives each row the worst tone of its last three blocks", () => {
    expect(rows.map((row) => row.tone)).toEqual(["err", "ok", "muted"]);
    expect(
      worstTone([
        { tone: "ok" },
        { tone: "err" },
        { tone: "muted" },
        { tone: "muted" },
        { tone: "ok" },
      ]),
    ).toBe("ok");
  });

  it("marks a block with data accent when no threshold is set", () => {
    const plain = trackerRows(hours, { at: "at", by: "platform" }, window);
    expect(plain[0]?.cells.at(-2)?.tone).toBe("accent");
    expect(plain[0]?.cells.at(-3)?.tone).toBe("muted");
  });
});
