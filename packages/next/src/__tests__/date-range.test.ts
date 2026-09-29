import type { DateRangePreset } from "@flowpanel/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { previousRangeFor, resolveDateRange, shiftRange } from "../runtime/date-range";

describe("resolveDateRange", () => {
  it("falls back to the preset when a bound is not a date", () => {
    const range = resolveDateRange({ preset: "today", from: "abc", to: "def" });
    expect(range.preset).toBe("today");
    expect(Number.isNaN(range.from.getTime())).toBe(false);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("last7d returns [now-7d, now]", () => {
    const r = resolveDateRange({ preset: "last7d" });
    expect(r.preset).toBe("last7d");
    expect(r.to.toISOString()).toBe("2026-04-22T12:00:00.000Z");
    expect(r.from.toISOString()).toBe("2026-04-15T12:00:00.000Z");
  });

  it("today returns start-of-day to now", () => {
    const r = resolveDateRange({ preset: "today" });
    expect(r.preset).toBe("today");
    expect(r.from.toISOString()).toBe("2026-04-22T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-04-22T12:00:00.000Z");
  });

  it("yesterday returns start-of-yesterday to end-of-yesterday", () => {
    const r = resolveDateRange({ preset: "yesterday" });
    expect(r.preset).toBe("yesterday");
    expect(r.from.toISOString()).toBe("2026-04-21T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-04-21T23:59:59.999Z");
  });

  it("last30d spans 30 days", () => {
    const r = resolveDateRange({ preset: "last30d" });
    expect(r.preset).toBe("last30d");
    expect(r.from.toISOString()).toBe("2026-03-23T12:00:00.000Z");
  });

  it("MTD starts at month beginning", () => {
    const r = resolveDateRange({ preset: "MTD" });
    expect(r.preset).toBe("MTD");
    expect(r.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("QTD starts at quarter beginning", () => {
    const r = resolveDateRange({ preset: "QTD" });
    expect(r.preset).toBe("QTD");
    // April is in Q2 → starts at April 1
    expect(r.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });

  it("YTD starts at year beginning", () => {
    const r = resolveDateRange({ preset: "YTD" });
    expect(r.preset).toBe("YTD");
    expect(r.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("custom from/to honored", () => {
    const r = resolveDateRange({
      from: new Date("2026-01-01"),
      to: new Date("2026-02-01"),
    });
    expect(r.preset).toBe("custom");
    expect(r.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("defaults to last7d when input is empty", () => {
    const r = resolveDateRange({});
    expect(r.preset).toBe("last7d");
  });
});

describe("resolveDateRange in a configured zone", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts today, yesterday and the calendar presets at midnight in the zone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T22:30:00Z"));
    const zone = "Europe/Moscow";
    expect(resolveDateRange({ preset: "today" }, zone).from.toISOString()).toBe(
      "2026-04-22T21:00:00.000Z",
    );
    const yesterday = resolveDateRange({ preset: "yesterday" }, zone);
    expect(yesterday.from.toISOString()).toBe("2026-04-21T21:00:00.000Z");
    expect(yesterday.to.toISOString()).toBe("2026-04-22T20:59:59.999Z");
    expect(resolveDateRange({ preset: "MTD" }, zone).from.toISOString()).toBe(
      "2026-03-31T21:00:00.000Z",
    );
    expect(resolveDateRange({ preset: "QTD" }, zone).from.toISOString()).toBe(
      "2026-03-31T21:00:00.000Z",
    );
    expect(resolveDateRange({ preset: "YTD" }, zone).from.toISOString()).toBe(
      "2025-12-31T21:00:00.000Z",
    );
  });

  it("keeps the rolling presets as elapsed time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T22:30:00Z"));
    expect(resolveDateRange({ preset: "last7d" }, "Europe/Moscow").from.toISOString()).toBe(
      "2026-04-15T22:30:00.000Z",
    );
  });

  it("finds midnight on the day the clocks move", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));
    expect(resolveDateRange({ preset: "today" }, "Europe/Berlin").from.toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    expect(resolveDateRange({ preset: "yesterday" }, "Europe/Berlin").from.toISOString()).toBe(
      "2026-03-27T23:00:00.000Z",
    );
  });

  it("starts a day whose midnight the clocks skip when the clocks resume", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));
    const zone = "Atlantic/Azores";
    expect(resolveDateRange({ preset: "today" }, zone).from.toISOString()).toBe(
      "2026-03-29T01:00:00.000Z",
    );
    expect(resolveDateRange({ preset: "yesterday" }, zone).to.toISOString()).toBe(
      "2026-03-29T00:59:59.999Z",
    );
  });
});

describe("previousRangeFor", () => {
  const zone = "Europe/Moscow";
  const iso = (range: { from: Date; to: Date }) => ({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function previousOf(preset: DateRangePreset, now: string, timeZone = zone) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    return iso(previousRangeFor(resolveDateRange({ preset }, timeZone), timeZone));
  }

  it("compares today and yesterday with the day before, up to the same clock time", () => {
    expect(previousOf("today", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-09-21T21:00:00.000Z",
      to: "2026-09-22T07:00:00.000Z",
    });
    expect(previousOf("yesterday", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-09-20T21:00:00.000Z",
      to: "2026-09-21T20:59:59.999Z",
    });
  });

  it("compares month, quarter and year to date with the same days one period back", () => {
    expect(previousOf("MTD", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-07-31T21:00:00.000Z",
      to: "2026-08-23T07:00:00.000Z",
    });
    expect(previousOf("QTD", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-03-31T21:00:00.000Z",
      to: "2026-06-23T07:00:00.000Z",
    });
    expect(previousOf("YTD", "2026-09-23T07:00:00Z")).toEqual({
      from: "2024-12-31T21:00:00.000Z",
      to: "2025-09-23T07:00:00.000Z",
    });
  });

  it("clamps month to date to the length of the shorter month before it", () => {
    expect(previousOf("MTD", "2026-03-31T07:00:00Z")).toEqual({
      from: "2026-01-31T21:00:00.000Z",
      to: "2026-02-28T07:00:00.000Z",
    });
  });

  it("shifts the rolling presets and a custom range by their own length", () => {
    expect(previousOf("last7d", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-09-09T07:00:00.000Z",
      to: "2026-09-16T07:00:00.000Z",
    });
    expect(previousOf("last30d", "2026-09-23T07:00:00Z")).toEqual({
      from: "2026-07-25T07:00:00.000Z",
      to: "2026-08-24T07:00:00.000Z",
    });
    const custom = {
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-09-11T00:00:00Z"),
      preset: "custom" as const,
    };
    expect(iso(previousRangeFor(custom, zone))).toEqual({
      from: "2026-08-22T00:00:00.000Z",
      to: "2026-09-01T00:00:00.000Z",
    });
  });

  it("keeps the clock time across the day the clocks move", () => {
    expect(previousOf("today", "2026-03-30T12:00:00Z", "Europe/Berlin")).toEqual({
      from: "2026-03-28T23:00:00.000Z",
      to: "2026-03-29T12:00:00.000Z",
    });
  });

  it("moves a range a week back at the same clock time", () => {
    const today = { from: new Date("2026-09-22T21:00:00Z"), to: new Date("2026-09-23T07:00:00Z") };
    expect(iso(shiftRange(today, zone, { days: -7 }))).toEqual({
      from: "2026-09-15T21:00:00.000Z",
      to: "2026-09-16T07:00:00.000Z",
    });
  });
});
