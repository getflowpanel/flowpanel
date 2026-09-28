import { describe, expect, it } from "vitest";
import {
  enumOf,
  groupTimeline,
  mergeTimeline,
  pickedKinds,
  readTimelineCursor,
  type TimelineEvent,
  timelineKindsOf,
  writeTimelineCursor,
} from "../index";

const ev = (iso: string, kind: string, title = kind, extra: Partial<TimelineEvent> = {}) => ({
  at: new Date(iso),
  kind,
  title,
  ...extra,
});

describe("mergeTimeline", () => {
  const a = [ev("2026-09-25T10:00:00Z", "visit", "a1"), ev("2026-09-25T08:00:00Z", "visit", "a2")];
  const b = [ev("2026-09-25T10:00:00Z", "reply", "b1"), ev("2026-09-25T09:00:00Z", "reply", "b2")];

  it("orders every list by time, keeping list order on a tie", () => {
    const { events } = mergeTimeline([a, b], null, 10, null);
    expect(events.map((e) => e.title)).toEqual(["a1", "b1", "b2", "a2"]);
  });

  it("carries the tie count in the cursor and skips shown ties on the next page", () => {
    const first = mergeTimeline([a, b], null, 1, null);
    expect(first.events.map((e) => e.title)).toEqual(["a1"]);
    expect(first.next).toEqual({ before: new Date("2026-09-25T10:00:00Z"), skip: 1 });
    const second = mergeTimeline([a, b], first.next, 1, null);
    expect(second.events.map((e) => e.title)).toEqual(["b1"]);
    expect(second.next).toEqual({ before: new Date("2026-09-25T10:00:00Z"), skip: 2 });
    const third = mergeTimeline([a, b], second.next, 5, null);
    expect(third.events.map((e) => e.title)).toEqual(["b2", "a2"]);
    expect(third.next).toBeNull();
  });

  it("keeps only the picked kinds", () => {
    expect(mergeTimeline([a, b], null, 10, ["reply"]).events.map((e) => e.title)).toEqual([
      "b1",
      "b2",
    ]);
  });
});

describe("timeline cursors and kinds", () => {
  it("round-trips a cursor and rejects an unreadable one", () => {
    const cursor = { before: new Date("2026-09-25T10:00:00.000Z"), skip: 2 };
    expect(readTimelineCursor(writeTimelineCursor(cursor))).toEqual(cursor);
    expect(readTimelineCursor("2026-09-25T10:00:00.000Z")).toEqual({ ...cursor, skip: 0 });
    expect(readTimelineCursor("yesterday~1")).toBeNull();
    expect(readTimelineCursor("2026-09-25T10:00:00.000Z~-1")).toBeNull();
    expect(readTimelineCursor(null)).toBeNull();
  });

  it("reads picked kinds, dropping unknown ones", () => {
    expect(pickedKinds("reply,nope", ["visit", "reply"])).toEqual(["reply"]);
    expect(pickedKinds("nope", ["visit"])).toBeNull();
    expect(pickedKinds(null, ["visit"])).toBeNull();
  });

  it("takes kinds as an enumOf or as entries", () => {
    const Kinds = enumOf({ visit: ["Visit", "info"] });
    expect(timelineKindsOf(Kinds)).toBe(Kinds);
    const entries = timelineKindsOf({ visit: ["Visit", "info"], reply: "Reply" });
    expect(entries.values).toEqual(["visit", "reply"]);
    expect(entries.tone("visit")).toBe("info");
  });
});

describe("groupTimeline", () => {
  it("groups by the calendar day of the zone, across a DST change", () => {
    const days = groupTimeline(
      [
        ev("2026-03-29T22:30:00Z", "visit"),
        ev("2026-03-29T21:59:00Z", "visit", "late"),
        ev("2026-03-28T23:30:00Z", "visit", "early"),
      ],
      "Europe/Berlin",
      "day",
    );
    expect(days.map((d) => [d.day, d.count])).toEqual([
      ["2026-03-30", 1],
      ["2026-03-29", 2],
    ]);
  });

  it("folds only consecutive events of one kind with one fold key", () => {
    const [day] = groupTimeline(
      [
        ev("2026-09-25T10:00:00Z", "feed", "Orders in feed"),
        ev("2026-09-25T09:00:00Z", "feed", "Orders in feed"),
        ev("2026-09-25T08:00:00Z", "reply", "Sent"),
        ev("2026-09-25T07:00:00Z", "feed", "Orders in feed"),
        ev("2026-09-25T06:00:00Z", "visit", "Orders in feed", { fold: "Orders in feed" }),
      ],
      "UTC",
      "day",
    );
    expect(day?.lines.map((line) => line.length)).toEqual([2, 1, 1, 1]);
  });

  it("gives one group without a day when grouping is off", () => {
    const days = groupTimeline(
      [ev("2026-09-25T10:00:00Z", "visit"), ev("2026-09-20T10:00:00Z", "visit")],
      "UTC",
      false,
    );
    expect(days).toHaveLength(1);
    expect(days[0]?.day).toBeNull();
  });

  it("still folds only within one calendar day when grouping is off", () => {
    const [day] = groupTimeline(
      [
        ev("2026-09-22T09:12:00Z", "feed", "Orders in feed"),
        ev("2026-09-21T18:40:00Z", "feed", "Orders in feed"),
      ],
      "UTC",
      false,
    );
    expect(day?.lines.map((line) => line.length)).toEqual([1, 1]);
  });
});
