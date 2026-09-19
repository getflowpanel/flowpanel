import { describe, expect, it } from "vitest";
import { parseSqlRows, sanitizeSqlParams } from "../runtime/sql-params";

describe("sanitizeSqlParams", () => {
  it("binds a Date as ISO-8601 text and a bigint as decimal text", () => {
    expect(sanitizeSqlParams([new Date("2026-01-02T03:04:05.000Z"), 9007199254740993n])).toEqual([
      "2026-01-02T03:04:05.000Z",
      "9007199254740993",
    ]);
  });

  it("reaches into an array so an IN list is bindable too", () => {
    expect(sanitizeSqlParams([[1n, new Date(0)]])).toEqual([["1", "1970-01-01T00:00:00.000Z"]]);
  });

  it("leaves every other value alone", () => {
    expect(sanitizeSqlParams(["a", 1, true, null, undefined, { a: 1 }])).toEqual([
      "a",
      1,
      true,
      null,
      undefined,
      { a: 1 },
    ]);
  });
});

describe("parseSqlRows", () => {
  it("reads a zoneless timestamp string as UTC", () => {
    const [row] = parseSqlRows<{ at: Date }>([{ at: "2026-01-02 03:04:05" }]);
    expect(row?.at).toBeInstanceOf(Date);
    expect(row?.at.toISOString()).toBe("2026-01-02T03:04:05.000Z");
  });

  it("accepts the T separator and fractional seconds", () => {
    const [row] = parseSqlRows<{ at: Date }>([{ at: "2026-01-02T03:04:05.250" }]);
    expect((row?.at as Date).toISOString()).toBe("2026-01-02T03:04:05.250Z");
  });

  it("hands every value through untouched when parseDates is false", () => {
    const rows = [{ at: "2026-01-02 03:04:05" }];
    expect(parseSqlRows<{ at: string }>(rows, { parseDates: false })).toEqual(rows);
    expect(parseSqlRows<{ at: Date }>(rows, { parseDates: true })[0]?.at).toBeInstanceOf(Date);
    expect(parseSqlRows<{ at: Date }>(rows, {})[0]?.at).toBeInstanceOf(Date);
  });

  it("leaves strings that are not exactly that shape untouched", () => {
    const [row] = parseSqlRows<Record<string, unknown>>([
      {
        date: "2026-01-02",
        zoned: "2026-01-02 03:04:05+02",
        prose: "seen at 2026-01-02 03:04:05 sharp",
        n: 3,
        nothing: null,
      },
    ]);
    expect(row).toEqual({
      date: "2026-01-02",
      zoned: "2026-01-02 03:04:05+02",
      prose: "seen at 2026-01-02 03:04:05 sharp",
      n: 3,
      nothing: null,
    });
  });
});
