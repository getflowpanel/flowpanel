import { resolveFormatting } from "@flowpanel/core/format";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTickFormatter, formatTick } from "../format-tick";

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

  it("keeps the time component for full datetime strings, read in the admin's zone", () => {
    const la = resolveFormatting({ timeZone: "America/Los_Angeles" });
    expect(formatTick("2026-07-01T14:30:00", "minute", la)).toBe("2026-07-01 14:30");
  });
});

describe("formatTick — the admin's formatting", () => {
  const instant = "2026-09-22T23:30:00.000Z";

  it("reads an instant in the configured zone, not the server's", () => {
    expect(formatTick(instant, "day")).toBe("2026-09-22");
    expect(formatTick(instant, "day", resolveFormatting({ timeZone: "Asia/Bangkok" }))).toBe(
      "2026-09-23",
    );
    expect(formatTick(instant, "hour", resolveFormatting({ timeZone: "Asia/Bangkok" }))).toBe(
      "2026-09-23 06:30",
    );
  });

  it("follows a configured locale, the way a table cell does", () => {
    expect(formatTick(instant, "day", resolveFormatting({ locale: "de-DE" }))).toBe("22.09.2026");
  });

  it("leaves a calendar day on its own date whatever the zone is", () => {
    expect(formatTick("2026-07-01", "day", resolveFormatting({ timeZone: "Asia/Bangkok" }))).toBe(
      "2026-07-01",
    );
  });

  it("hands the formatting to the closure a chart axis calls", () => {
    const format = buildTickFormatter(
      [{ t: instant }],
      "t",
      "hour",
      resolveFormatting({ timeZone: "Asia/Bangkok" }),
    );
    expect(format(instant)).toBe("2026-09-23 06:30");
  });
});
