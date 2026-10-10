import { formatDateTime } from "@flowpanel/core/format";
import { describe, expect, it } from "vitest";
import { absoluteTime } from "../absolute-time";

const at = new Date("2026-10-09T14:05:09Z");

describe("absoluteTime", () => {
  it("joins the date and the time itself, never with the engine's own word", () => {
    for (const locale of ["en-US", "en-GB", "ru-RU", "de-DE"]) {
      const text = absoluteTime(at, locale, "UTC");
      expect(text).not.toMatch(/\sat\s|\sв\s|\sum\s/);
      const day = new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(at);
      expect(text.startsWith(`${day}, `)).toBe(true);
    }
  });

  it("keeps the time zone on the time", () => {
    expect(absoluteTime(at, "en-US", "UTC")).toBe("Oct 9, 2026, 2:05:09 PM UTC");
  });
});

describe("formatDateTime", () => {
  it("formats a date alone or a time alone in one piece", () => {
    expect(formatDateTime(at, "en-US", { month: "long", day: "numeric", timeZone: "UTC" })).toBe(
      "October 9",
    );
    expect(formatDateTime(at, "en-US", { hour: "numeric", timeZone: "UTC" })).toBe("2 PM");
  });

  it("uses the joiner it is given", () => {
    const options: Intl.DateTimeFormatOptions = {
      month: "long",
      day: "numeric",
      hour: "numeric",
      timeZone: "UTC",
    };
    expect(formatDateTime(at, "en-US", options, " ")).toBe("October 9 2 PM");
  });

  it("splits dateStyle and timeStyle too", () => {
    const styled = { dateStyle: "long", timeStyle: "short", timeZone: "UTC" } as const;
    expect(formatDateTime(at, "en-US", styled)).toBe("October 9, 2026, 2:05 PM");
  });
});
