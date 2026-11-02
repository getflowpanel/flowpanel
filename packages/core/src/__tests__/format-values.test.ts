import { describe, expect, it } from "vitest";
import { formatColumnValue } from "../format-column";
import {
  cellTone,
  columnFormatKind,
  formatBooleanValue,
  formatDurationCompact,
  formatDurationValue,
  formatPercentValue,
  formatRelativeValue,
  percentHeatLevel,
  toBooleanValue,
  toDateValue,
  urlCellParts,
} from "../format-values";
import { resolveFormatting } from "../types/formatting";

const en = resolveFormatting();
const ru = resolveFormatting({ locale: "ru-RU" });
const now = new Date("2026-09-23T12:00:00Z");

describe("formatDurationValue", () => {
  it("uses the largest units that fit", () => {
    expect(formatDurationValue(250, en)).toBe("250 ms");
    expect(formatDurationValue(4200, en)).toBe("4.2 sec");
    expect(formatDurationValue(42_000, en)).toBe("42 sec");
    expect(formatDurationValue(300_000, en)).toBe("5 min");
    expect(formatDurationValue(7_500_000, en)).toBe("2 hr 5 min");
    expect(formatDurationValue(90_000_000, en)).toBe("1 day 1 hr");
  });

  it("speaks the admin's locale", () => {
    expect(formatDurationValue(4200, ru)).toBe("4,2 с");
    expect(formatDurationValue(7_500_000, ru)).toBe("2 ч 5 мин");
  });

  it("drops a zero part and keeps the sign", () => {
    expect(formatDurationValue(3_600_000, en)).toBe("1 hr");
    expect(formatDurationValue(-300_000, en)).toBe("-5 min");
  });

  it("rounds before it picks a unit, so 59.999 seconds reads as a minute", () => {
    expect(formatDurationValue(999.6, en)).toBe("1 sec");
    expect(formatDurationValue(9_960, en)).toBe("10 sec");
    expect(formatDurationValue(59_400, en)).toBe("59 sec");
    expect(formatDurationValue(59_999, en)).toBe("1 min");
  });

  it("drops the sign of a value that rounds to zero", () => {
    expect(formatDurationValue(-0.2, en)).toBe("0 ms");
    expect(formatDurationValue(-0.6, en)).toBe("-1 ms");
  });
});

describe("formatDurationCompact", () => {
  it("keeps only the largest unit, with one decimal at most, for a chart axis", () => {
    expect(formatDurationCompact(7_500_000, en)).toBe("2.1h");
    expect(formatDurationCompact(42_000, en)).toBe("42s");
    expect(formatDurationCompact(250, en)).toBe("250ms");
    expect(formatDurationCompact(7_500_000, ru)).toBe("2,1 ч");
  });

  it("rounds before it picks a unit, so 59.999 seconds reads as a minute", () => {
    expect(formatDurationCompact(59_999, en)).toBe("1m");
    expect(formatDurationCompact(3_599_999, en)).toBe("1h");
    expect(formatDurationCompact(999.96, en)).toBe("1s");
    expect(formatDurationCompact(59_900, en)).toBe("59.9s");
  });
});

describe("formatPercentValue", () => {
  it("reads a fraction, with at most the given decimals", () => {
    expect(formatPercentValue(0.423, en)).toBe("42.3%");
    expect(formatPercentValue(0.4, en, 0)).toBe("40%");
    expect(formatPercentValue(0.423, ru)).toMatch(/^42,3\s%$/);
  });

  it("keeps decimals from 0 to 20 instead of throwing on a typo", () => {
    expect(formatPercentValue(0.4231, en, -1)).toBe("42%");
    expect(formatPercentValue(0.4231, en, 99)).toBe("42.31%");
    expect(formatPercentValue(0.4231, en, Number.NaN)).toBe("42.3%");
  });
});

describe("formatRelativeValue", () => {
  it("says how long ago, in the admin's locale", () => {
    expect(formatRelativeValue(new Date("2026-09-23T11:55:00Z"), en, now)).toBe("5 minutes ago");
    expect(formatRelativeValue("2026-09-23T11:55:00Z", ru, now)).toBe("5 минут назад");
    expect(formatRelativeValue(new Date("2026-09-22T12:00:00Z"), en, now)).toBe("yesterday");
  });

  it("leaves a value that is not a moment as text", () => {
    expect(formatRelativeValue("soon", en, now)).toBe("soon");
    expect(formatRelativeValue("5", en, now)).toBe("5");
  });

  it("reads a zoneless timestamp as UTC", () => {
    expect(formatRelativeValue("2026-09-23 11:55:00", en, now)).toBe("5 minutes ago");
  });

  it("rounds before it picks a unit, so 59.6 minutes reads as an hour", () => {
    const ago = (ms: number) => formatRelativeValue(new Date(now.getTime() - ms), en, now);
    expect(ago(59_600)).toBe("1 minute ago");
    expect(ago(40 * 60_000)).toBe("40 minutes ago");
    expect(ago(59.6 * 60_000)).toBe("1 hour ago");
    expect(ago(23.6 * 3_600_000)).toBe("yesterday");
    expect(ago(29.6 * 86_400_000)).toBe("last month");
  });
});

describe("toDateValue", () => {
  const iso = (value: unknown) => toDateValue(value)?.toISOString() ?? null;

  it("reads a zoneless timestamp as UTC and an ISO moment by its own zone", () => {
    expect(iso("2026-09-23 21:30:00")).toBe("2026-09-23T21:30:00.000Z");
    expect(iso("2026-09-23T21:30:00.5")).toBe("2026-09-23T21:30:00.500Z");
    expect(iso("2026-09-23T21:30:00.000Z")).toBe("2026-09-23T21:30:00.000Z");
    expect(iso("2026-09-23T21:30Z")).toBe("2026-09-23T21:30:00.000Z");
    expect(iso("2026-09-24 04:30:00+07")).toBe("2026-09-23T21:30:00.000Z");
    expect(iso("2026-09-24T04:30:00+0700")).toBe("2026-09-23T21:30:00.000Z");
    expect(iso("2026-09-23 16:30:00.123456-05:00")).toBe("2026-09-23T21:30:00.123Z");
    expect(iso("2026-09-23")).toBe("2026-09-23T00:00:00.000Z");
    expect(iso(Date.UTC(2026, 8, 23))).toBe("2026-09-23T00:00:00.000Z");
  });

  it("leaves anything else alone", () => {
    expect(iso("5")).toBeNull();
    expect(iso("Sep 23 2026")).toBeNull();
    expect(iso("2026-13-40")).toBeNull();
    expect(iso("2026-09-23T21:30:00+7")).toBeNull();
    expect(iso(true)).toBeNull();
  });
});

describe("column format helpers", () => {
  it("names the kind of a string or an object format", () => {
    expect(columnFormatKind("relative")).toBe("relative");
    expect(columnFormatKind({ kind: "percent", heat: true })).toBe("percent");
  });

  it("shades a heat cell in five steps and ignores other cells", () => {
    expect(percentHeatLevel(0.42, { kind: "percent", heat: true })).toBe(2);
    expect(percentHeatLevel(1.7, { kind: "percent", heat: true })).toBe(5);
    expect(percentHeatLevel(0.42, "percent")).toBeNull();
    expect(percentHeatLevel(" ", { kind: "percent", heat: true })).toBeNull();
    expect(percentHeatLevel("n/a", { kind: "percent", heat: true })).toBeNull();
  });

  it("links only http(s) and same-site URLs", () => {
    expect(urlCellParts("https://kwork.ru/projects/1/", "url")).toEqual({
      href: "https://kwork.ru/projects/1/",
      text: "kwork.ru/projects/1/",
    });
    expect(urlCellParts("https://kwork.ru", { kind: "url", label: "Open" })).toEqual({
      href: "https://kwork.ru",
      text: "Open",
    });
    expect(urlCellParts("/admin/order/7", "url")).toEqual({
      href: "/admin/order/7",
      text: "/admin/order/7",
    });
    expect(urlCellParts("javascript:alert(1)", "url")).toBeNull();
    expect(urlCellParts("//evil.example", "url")).toBeNull();
    expect(urlCellParts("/\\evil.example", "url")).toBeNull();
    expect(urlCellParts("/\t/evil.example", "url")).toBeNull();
    expect(urlCellParts("https://kwork.ru", "number")).toBeNull();
  });

  it("writes a boolean as a glyph unless the format names words", () => {
    expect(formatBooleanValue(true, "boolean")).toBe("✓");
    expect(formatBooleanValue(false, "boolean")).toBe("✕");
    expect(
      formatBooleanValue(true, { kind: "boolean", labels: { true: "да", false: "нет" } }),
    ).toBe("да");
  });

  it("reads SQLite's 1 and 0 as true and false", () => {
    expect(formatBooleanValue(1, "boolean")).toBe("✓");
    expect(formatBooleanValue(0, { kind: "boolean", labels: { false: "нет" } })).toBe("нет");
    expect(formatBooleanValue(2, "boolean")).toBe("2");
  });

  it("tells a boolean-like value from any other", () => {
    expect([true, "true", 1].map(toBooleanValue)).toEqual([true, true, true]);
    expect([false, "false", 0].map(toBooleanValue)).toEqual([false, false, false]);
    expect([2, "yes", null, undefined].map(toBooleanValue)).toEqual([null, null, null, null]);
  });
});

describe("cellTone", () => {
  const tones = { warn: 0.3, err: 0.5 };

  it("tones a numeric cell against its format's threshold", () => {
    expect(cellTone(0.6, { kind: "percent", tones })).toBe("err");
    expect(cellTone("0.35", { kind: "number", tones })).toBe("warn");
    expect(cellTone(100, { kind: "duration", tones: { warn: 200, err: 400 } })).toBe("ok");
  });

  it("leaves a cell without a threshold, a badge and a non-number alone", () => {
    expect(cellTone(0.6, { kind: "percent" })).toBeNull();
    expect(cellTone("err", { kind: "badge", tones: { err: "err" } })).toBeNull();
    expect(cellTone(0.6, "percent")).toBeNull();
    expect(cellTone("n/a", { kind: "number", tones })).toBe("muted");
  });

  it("prints an object number format like the string one", () => {
    expect(formatColumnValue(1234.5, { kind: "number" })).toBe(formatColumnValue(1234.5, "number"));
  });
});
