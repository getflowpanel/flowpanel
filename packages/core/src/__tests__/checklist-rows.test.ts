import { describe, expect, it } from "vitest";
import { filled } from "../index";
import { checklistRows, isDone } from "../internal";

describe("checklist presence", () => {
  it("takes a day-precision Date's day in the admin's zone", () => {
    const localMidnight = new Date("2026-09-23T21:00:00Z");
    const { rows } = checklistRows(
      [{ label: "a", done: localMidnight, precision: "day" }],
      true,
      "Europe/Moscow",
    );
    expect(rows[0]?.day).toBe("2026-09-24");
  });

  it("counts every value but an empty one as done", () => {
    expect([null, undefined, false, "", "  ", []].map(isDone)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([0, "x", true, ["a"], new Date(0), {}].map(isDone)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it("builds one item per labelled field, zero counting as filled", () => {
    expect(
      filled(
        { bio: "  ", rate: 0, tags: [] as string[], site: "x.dev" },
        { bio: "Bio", rate: "Rate", tags: "Tags" },
      ),
    ).toEqual([
      { label: "Bio", done: false },
      { label: "Rate", done: true },
      { label: "Tags", done: false },
    ]);
    expect(filled(null, { bio: "Bio" })).toEqual([{ label: "Bio", done: false }]);
  });
});

describe("checklistRows", () => {
  it("reads a zoneless timestamp as UTC, as every other date path does", () => {
    const { rows } = checklistRows([{ label: "a", done: "2026-09-24 12:00:00" }], true);
    expect(rows[0]?.at?.toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });

  it("skips the gap around a step known only by its day", () => {
    const { rows } = checklistRows(
      [
        { label: "a", done: new Date("2026-09-24T10:00:00Z") },
        { label: "b", done: new Date("2026-09-24T00:00:00Z"), precision: "day" },
        { label: "c", done: new Date("2026-09-24T12:00:00Z") },
        { label: "d", done: new Date("2026-09-24T12:30:00Z") },
      ],
      true,
    );
    expect(rows.map((row) => [row.day, row.gapMs])).toEqual([
      [null, null],
      ["2026-09-24", null],
      [null, null],
      [null, 1_800_000],
    ]);
  });

  it("reads a bare YYYY-MM-DD as a day, and measures no gap backwards", () => {
    const { rows } = checklistRows(
      [
        { label: "a", done: "2026-09-23" },
        { label: "b", done: "2026-09-24T12:00:00Z" },
        { label: "c", done: "2026-09-24T11:00:00Z" },
      ],
      true,
    );
    expect(rows.map((row) => [row.day, row.at?.toISOString() ?? null, row.gapMs])).toEqual([
      ["2026-09-23", null, null],
      [null, "2026-09-24T12:00:00.000Z", null],
      [null, "2026-09-24T11:00:00.000Z", null],
    ]);
  });

  it("prints no date and no gap when not ordered", () => {
    const { rows } = checklistRows([{ label: "a", done: new Date("2026-09-24T10:00:00Z") }], false);
    expect(rows[0]).toEqual({ label: "a", state: "done", at: null, day: null, gapMs: null });
  });

  it("leaves optional items out of the summary", () => {
    const { rows, done, total } = checklistRows(
      [
        { label: "a", done: true },
        { label: "b", done: false, optional: true },
        { label: "c", done: true, optional: true },
        { label: "d", done: null, hint: "Ask in the bot", tone: "warn", href: "/help" },
      ],
      false,
    );
    expect([done, total]).toEqual([1, 2]);
    expect(rows.map((row) => row.state)).toEqual(["done", "optional", "done", "todo"]);
    expect(rows[3]).toMatchObject({ hint: "Ask in the bot", tone: "warn", href: "/help" });
  });
});
