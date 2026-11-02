import { defineAdmin, resource } from "@flowpanel/core";
import { parseWallTime } from "@flowpanel/core/internal";
import { describe, expect, it } from "vitest";
import { dateInputFor, dateInputValue, keepUntouchedTimes } from "../runtime/form-dates";
import { generatedFormFields } from "../runtime/resolve-form-fields";

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
    expect(dateInputFor(undefined, { type: "date" })).toBe("datetime-local");
    expect(dateInputFor(undefined, { type: "date", dateOnly: true })).toBe("date");
    expect(dateInputFor(undefined, { type: "string" })).toBeUndefined();
    expect(dateInputFor({ type: "date" }, { type: "date" })).toBe("date");
    expect(dateInputFor({ type: "datetime" }, { type: "date", dateOnly: true })).toBe(
      "datetime-local",
    );
    expect(dateInputFor({ type: "text" }, { type: "date" })).toBeUndefined();
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
    expect(parseWallTime("2026-10-06T23:37:05.250", "UTC")?.toISOString()).toBe(
      "2026-10-06T23:37:05.250Z",
    );
    for (const nonexistent of ["2026-02-30T10:00", "2026-13-01T10:00", "2026-10-06T25:99"]) {
      expect(parseWallTime(nonexistent, "UTC")?.getTime()).toBeNaN();
    }
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

describe("a generated form field for a SQL date column", () => {
  it("is a date control, and a timestamp a datetime one", () => {
    const users = defineAdmin({
      adapter: {
        kind: "drizzle",
        db: {},
        introspect: () => ({ name: "users", columns: [], primaryKey: "id" }),
        inferSchema: () => ({}) as never,
        list: async () => ({ rows: [], total: 0, page: 1, pageSize: 20 }),
        get: async () => null,
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => undefined,
      },
      auth: { session: async () => null, role: () => "guest" },
      resources: [resource({ __name: "users" }, { columns: ["birthday", "lastSeenAt"] })],
    }).resourcesByName.get("users");
    if (!users) throw new Error("fixture: resource not registered");
    const date = { nullable: true, unique: false, primaryKey: false, type: "date" as const };
    const fields = generatedFormFields(
      users,
      [
        { ...date, name: "birthday", dateOnly: true },
        { ...date, name: "lastSeenAt" },
      ],
      "update",
    );
    expect(fields.map((field) => [field.name, field.type])).toEqual([
      ["birthday", "date"],
      ["lastSeenAt", "datetime"],
    ]);
  });
});
