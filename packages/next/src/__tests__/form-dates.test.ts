import { describe, expect, it } from "vitest";
import {
  dateInputFor,
  dateInputValue,
  keepUntouchedTimes,
  parseWallTime,
} from "../runtime/form-dates";

const stored = new Date("2026-10-06T23:37:07.623Z");

describe("a stored timestamp in a form control", () => {
  it("shows on the admin's wall clock without a zone", () => {
    expect(dateInputValue(stored, "datetime-local", "UTC")).toBe("2026-10-06T23:37");
    expect(dateInputValue(stored, "datetime-local", "Europe/Moscow")).toBe("2026-10-07T02:37");
    expect(dateInputValue(stored.toISOString(), "datetime-local", "UTC")).toBe("2026-10-06T23:37");
  });

  it("shows a day for a date control, keeping a calendar day's own date", () => {
    expect(dateInputValue(stored, "date", "Europe/Moscow")).toBe("2026-10-07");
    expect(dateInputValue(new Date("2026-10-06T00:00:00Z"), "date", "America/Los_Angeles")).toBe(
      "2026-10-06",
    );
    expect(dateInputValue("2026-10-06", "date", "UTC")).toBe("2026-10-06");
    expect(dateInputValue("2026-10-06", "datetime-local", "UTC")).toBe("2026-10-06T00:00");
  });

  it("leaves an empty or unreadable value alone", () => {
    expect(dateInputValue(null, "datetime-local", "UTC")).toBeNull();
    expect(dateInputValue("soon", "datetime-local", "UTC")).toBe("soon");
  });

  it("picks the control from the declared field, else from the column", () => {
    expect(dateInputFor(undefined, "date")).toBe("datetime-local");
    expect(dateInputFor(undefined, "string")).toBeUndefined();
    expect(dateInputFor({ type: "date" }, "date")).toBe("date");
    expect(dateInputFor({ type: "datetime" }, "date")).toBe("datetime-local");
    expect(dateInputFor({ type: "text" }, "date")).toBeUndefined();
  });
});

describe("a posted datetime-local value", () => {
  it("reads on the admin's wall clock", () => {
    expect(parseWallTime("2026-10-07T02:37", "Europe/Moscow")?.toISOString()).toBe(
      "2026-10-06T23:37:00.000Z",
    );
    expect(parseWallTime("2026-10-06T23:37:05", "UTC")?.toISOString()).toBe(
      "2026-10-06T23:37:05.000Z",
    );
    expect(parseWallTime("2026-10-06T23:37:05Z", "UTC")).toBeNull();
    expect(parseWallTime("2026-10-06", "UTC")).toBeNull();
  });

  it("keeps the stored value when it shows the same minute", () => {
    const posted = { createdAt: new Date("2026-10-06T23:37:00Z"), name: "Dee" };
    expect(keepUntouchedTimes(posted, { createdAt: stored }, new Set(["createdAt"]))).toEqual({
      name: "Dee",
    });
    const moved = { createdAt: new Date("2026-10-06T23:38:00Z") };
    expect(keepUntouchedTimes(moved, { createdAt: stored }, new Set(["createdAt"]))).toEqual(moved);
  });
});
