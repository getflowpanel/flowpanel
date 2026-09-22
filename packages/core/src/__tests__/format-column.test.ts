import { describe, expect, it } from "vitest";
import { formatColumnValue, formatDateValue, formatDayValue, formatNumber } from "../format-column";
import { resolveFormatting } from "../types/formatting";

describe("formatColumnValue", () => {
  it("formats money from integer cents via scale", () => {
    expect(formatColumnValue(16065, { kind: "money", scale: 100 })).toBe("$160.65");
  });

  it("normalizes scale <= 0 to 1 (no division by zero)", () => {
    expect(formatColumnValue(5, { kind: "money", scale: 0 })).toBe("$5.00");
    expect(formatColumnValue(5, { kind: "money", scale: -2 })).toBe("$5.00");
  });

  it("defaults an unset currency to USD, and honours a declared one", () => {
    expect(formatColumnValue(12, { kind: "money" })).toBe("$12.00");
    expect(formatColumnValue(12, "money")).toBe("$12.00");
    expect(formatColumnValue(4200, { kind: "money", currency: "EUR", scale: 100 })).toBe("€42.00");
  });

  it("formats thousands-separated numbers", () => {
    expect(formatColumnValue(12345, "number")).toBe("12,345");
  });

  it("renders an em dash for nullish / empty", () => {
    expect(formatColumnValue(null, "number")).toBe("—");
    expect(formatColumnValue(undefined, "number")).toBe("—");
    expect(formatColumnValue("", "money")).toBe("—");
  });

  it("falls back to raw for non-numeric values (no false→0 coercion)", () => {
    expect(formatColumnValue(true, "money")).toBe("true");
    expect(formatColumnValue("n/a", "number")).toBe("n/a");
  });

  it("coerces numeric strings the same way as numbers", () => {
    expect(formatColumnValue("12345", "number")).toBe("12,345");
  });
});

describe("formatNumber", () => {
  it("reads locale and currency from the resolved formatting", () => {
    const de = resolveFormatting({ locale: "de-DE", currency: "EUR" });
    expect(formatNumber(1234.5, "currency", de)).toBe("1.235\u00a0€");
    expect(formatNumber(12345, "number", de)).toBe("12.345");
  });

  it("still accepts 0.2's third argument, a bare locale, with that release's currency", () => {
    expect(formatNumber(12345, "number", "de-DE")).toBe("12.345");
    expect(formatNumber(1234, "currency", "de-DE")).toBe(
      formatNumber(1234, "currency", resolveFormatting({ locale: "de-DE" })),
    );
    expect(formatNumber(1234, "currency", "en-US")).toBe("$1,234");
  });
});

describe("formatDateValue / formatDayValue", () => {
  const value = new Date("2026-09-22T23:30:00.000Z");

  it("renders one timestamp shape in the admin's date locale and zone", () => {
    expect(formatDateValue(value)).toBe("2026-09-22 23:30");
    expect(formatDateValue(value, resolveFormatting({ timeZone: "Asia/Bangkok" }))).toBe(
      "2026-09-23 06:30",
    );
  });

  it("drops the clock for a label a timestamp would crowd, in the same zone", () => {
    expect(formatDayValue(value)).toBe("2026-09-22");
    expect(formatDayValue(value, resolveFormatting({ timeZone: "Asia/Bangkok" }))).toBe(
      "2026-09-23",
    );
  });

  it("lets a caller pin the zone, for a calendar day that belongs to none", () => {
    expect(formatDayValue(value, resolveFormatting({ timeZone: "Asia/Bangkok" }), "UTC")).toBe(
      "2026-09-22",
    );
  });
});
