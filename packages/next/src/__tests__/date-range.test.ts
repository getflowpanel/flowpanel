import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDateRange } from "../runtime/date-range.js";

describe("resolveDateRange", () => {
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
