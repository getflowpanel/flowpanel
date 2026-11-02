import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presetRange } from "../runtime/preset-range";

const moscow = {
  dateRange: {
    from: new Date(0),
    to: new Date(0),
    preset: "custom" as const,
    previous: null,
    timeZone: "Europe/Moscow",
  },
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T09:30:00Z"));
});

afterEach(() => vi.useRealTimers());

describe("presetRange", () => {
  it("starts calendar presets at midnight in the admin's zone", () => {
    expect(presetRange("today", moscow)).toEqual({
      from: new Date("2026-09-20T21:00:00Z"),
      to: new Date("2026-09-21T09:30:00Z"),
    });
    expect(presetRange("MTD", moscow).from).toEqual(new Date("2026-08-31T21:00:00Z"));
  });

  it("reads last7d as elapsed time", () => {
    expect(presetRange("last7d", moscow).from).toEqual(new Date("2026-09-14T09:30:00Z"));
  });

  it("resolves at a given now, so two widgets get the same range", () => {
    const now = new Date("2026-09-21T12:00:00Z");
    expect(presetRange("today", moscow, now)).toEqual({
      from: new Date("2026-09-20T21:00:00Z"),
      to: now,
    });
  });
});
