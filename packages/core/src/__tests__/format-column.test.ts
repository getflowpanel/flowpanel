import { describe, expect, it, vi } from "vitest";
import {
  badgeProps,
  formatColumnValue,
  formatDateValue,
  formatDayValue,
  formatNumber,
} from "../format-column";
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

describe("badgeProps", () => {
  const format = {
    kind: "badge" as const,
    tones: { past_due: "err" as const },
    labels: { admin: "Админ" },
  };

  it("spaces the raw value, capitalizes it and carries its tone", () => {
    expect(badgeProps(format, "past_due")).toEqual({
      status: "past due",
      className: "capitalize",
      tone: "err",
    });
  });

  it("shows the label instead, without capitalizing it", () => {
    expect(badgeProps(format, "admin")).toEqual({ status: "admin", label: "Админ" });
  });

  it("returns null for an empty value", () => {
    expect(badgeProps("badge", "")).toBeNull();
    expect(badgeProps("badge", null)).toBeNull();
  });
});

describe("formatColumnValue — dates, relative time, percent, duration, boolean, url", () => {
  const utc = resolveFormatting();

  it("renders a day, or a day and a clock", () => {
    expect(formatColumnValue(new Date("2026-09-23T21:30:00Z"), "date", utc)).toBe("2026-09-23");
    expect(formatColumnValue("2026-09-23T21:30:00Z", { kind: "date", time: true }, utc)).toBe(
      "2026-09-23 21:30",
    );
  });

  it("reads a zoneless timestamp as UTC whatever the process zone, as ctx.sql rows do", () => {
    try {
      for (const zone of ["UTC", "Asia/Bangkok", "America/New_York"]) {
        vi.stubEnv("TZ", zone);
        for (const naive of ["2026-09-23 21:30:00", "2026-09-23T21:30:00"]) {
          expect(formatColumnValue(naive, { kind: "date", time: true }, utc)).toBe(
            formatColumnValue(`${naive.replace(" ", "T")}Z`, { kind: "date", time: true }, utc),
          );
          expect(formatColumnValue(naive, { kind: "date", time: true }, utc)).toBe(
            "2026-09-23 21:30",
          );
        }
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reads a timestamp with an offset, and leaves a string that is no ISO date as text", () => {
    const withTime = { kind: "date", time: true } as const;
    expect(formatColumnValue("2026-09-24 04:30:00+07", withTime, utc)).toBe("2026-09-23 21:30");
    expect(formatColumnValue("2026-09-24T04:30+07:00", withTime, utc)).toBe("2026-09-23 21:30");
    expect(formatColumnValue("5", "date", utc)).toBe("5");
    expect(formatColumnValue("Sep 23, 2026", "date", utc)).toBe("Sep 23, 2026");
    expect(formatColumnValue("5", "relative", utc)).toBe("5");
  });

  it("keeps a YYYY-MM-DD value on its own day in any zone", () => {
    const newYork = resolveFormatting({ timeZone: "America/New_York" });
    expect(formatColumnValue("2026-09-23", "date", newYork)).toBe("2026-09-23");
  });

  it("keeps a SQL date read as midnight UTC on its day when the column says calendarDay", () => {
    const losAngeles = resolveFormatting({ timeZone: "America/Los_Angeles" });
    const day = new Date("2026-10-07T00:00:00Z");
    expect(formatColumnValue(day, "date", losAngeles)).toBe("2026-10-06");
    expect(formatColumnValue(day, { kind: "date", calendarDay: true }, losAngeles)).toBe(
      "2026-10-07",
    );
  });

  it("renders a percent, a duration in ms or s, a boolean and a url", () => {
    expect(formatColumnValue(0.4231, { kind: "percent", digits: 2 }, utc)).toBe("42.31%");
    expect(formatColumnValue(0.4231, { kind: "percent", digits: -1 }, utc)).toBe("42%");
    expect(formatColumnValue("0.5", "percent", utc)).toBe("50%");
    expect(formatColumnValue(4200, "duration", utc)).toBe("4.2 sec");
    expect(formatColumnValue(300, { kind: "duration", unit: "s" }, utc)).toBe("5 min");
    expect(formatColumnValue(false, "boolean", utc)).toBe("✕");
    expect(formatColumnValue(0, "boolean", utc)).toBe("✕");
    expect(formatColumnValue("https://kwork.ru", "url", utc)).toBe("https://kwork.ru");
  });

  it("renders a relative time against the current clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
    expect(formatColumnValue(new Date("2026-09-23T10:00:00Z"), "relative", utc)).toBe(
      "2 hours ago",
    );
    vi.useRealTimers();
  });

  it("gives a widget's numeric percent and duration the same text", () => {
    expect(formatNumber(4200, "duration", utc)).toBe("4.2 sec");
    expect(formatNumber(0.423, "percent", utc)).toBe("42.3%");
  });
});
