import { describe, expect, it } from "vitest";
import { toWireValue } from "../wire/serialize.js";

describe("wire serializer", () => {
  it("normalizes dates and bigint without changing safe plain data", () => {
    expect(toWireValue({ at: new Date("2026-08-24T12:00:00Z"), amount: 12n })).toEqual({
      at: "2026-08-24T12:00:00.000Z",
      amount: "12",
    });
  });

  it.each([
    ["function", { run: () => undefined }],
    ["database class", { db: new Map() }],
    [
      "cycle",
      (() => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      })(),
    ],
  ])("rejects %s leakage", (_label, value) => {
    expect(() => toWireValue(value)).toThrow("Validation failed");
  });
});
