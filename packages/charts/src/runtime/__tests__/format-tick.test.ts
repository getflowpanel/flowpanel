import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatTick } from "../format-tick.js";

describe("formatTick clock consistency (west-of-UTC viewer)", () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    // A negative-offset zone — exactly the class of viewer that saw the
    // previous day's label under the old UTC-parse / local-format mismatch
    // (date-only strings parsed as UTC midnight, then read back with local
    // getters).
    process.env.TZ = "America/Los_Angeles";
  });

  afterAll(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  it("keeps a date-only string on its own calendar day for a day bucket", () => {
    expect(formatTick("2026-07-01", "day")).toBe("2026-07-01");
  });

  it("keeps a date-only string on its own calendar day for coarser buckets", () => {
    expect(formatTick("2026-01-01", "month")).toBe("2026-01-01");
    expect(formatTick("2026-01-01", "year")).toBe("2026-01-01");
  });

  it("keeps a date-only string on its own calendar day under the default (auto) bucket", () => {
    expect(formatTick("2026-07-01")).toBe("2026-07-01");
  });

  it("still strips the time component for a Date object at local midnight", () => {
    expect(formatTick(new Date(2026, 6, 1), "day")).toBe("2026-07-01");
  });

  it("keeps the time component for full datetime strings (unaffected by the date-only fix)", () => {
    expect(formatTick("2026-07-01T14:30:00", "minute")).toBe("2026-07-01 14:30");
  });
});
