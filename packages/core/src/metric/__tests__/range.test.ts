import { describe, expect, it } from "vitest";
import { defaultBucketFor, parseRange, previousRange } from "../range";

describe("parseRange", () => {
  it('resolves "30d" to {start: 30d ago, end: now}', () => {
    const now = new Date("2026-04-18T12:00:00Z");
    const r = parseRange("30d", now);
    expect(r.end.toISOString()).toBe("2026-04-18T12:00:00.000Z");
    expect(r.start.toISOString()).toBe("2026-03-19T12:00:00.000Z");
  });

  it('supports "24h", "7d", "12w", "6M"', () => {
    const now = new Date("2026-04-18T00:00:00Z");
    expect(parseRange("24h", now).start.toISOString()).toBe("2026-04-17T00:00:00.000Z");
    expect(parseRange("7d", now).start.toISOString()).toBe("2026-04-11T00:00:00.000Z");
    expect(parseRange("12w", now).start.toISOString()).toBe("2026-01-24T00:00:00.000Z");
    expect(parseRange("6M", now).start.toISOString()).toBe("2025-10-18T00:00:00.000Z");
  });

  it("throws on malformed input", () => {
    expect(() => parseRange("abc")).toThrow(/invalid range/i);
    expect(() => parseRange("10x")).toThrow(/invalid range/i);
    expect(() => parseRange("-5d")).toThrow(/invalid range/i);
  });
});

describe("previousRange", () => {
  it("returns a range of the same duration directly before", () => {
    const range = {
      start: new Date("2026-03-19T00:00:00Z"),
      end: new Date("2026-04-18T00:00:00Z"),
    };
    const prev = previousRange(range);
    expect(prev.end.toISOString()).toBe("2026-03-19T00:00:00.000Z");
    expect(prev.start.toISOString()).toBe("2026-02-17T00:00:00.000Z");
  });
});

describe("defaultBucketFor", () => {
  it("picks hour for <= 48h, day for <= 60d, week for <= 180d, month otherwise", () => {
    const end = new Date("2026-04-18T00:00:00Z");
    const h = (hrs: number) => ({ start: new Date(end.getTime() - hrs * 3600_000), end });
    expect(defaultBucketFor(h(24))).toBe("hour");
    expect(defaultBucketFor(h(48))).toBe("hour");
    expect(defaultBucketFor(h(72))).toBe("day");
    expect(defaultBucketFor(h(30 * 24))).toBe("day");
    expect(defaultBucketFor(h(90 * 24))).toBe("week");
    expect(defaultBucketFor(h(365 * 24))).toBe("month");
  });
});
