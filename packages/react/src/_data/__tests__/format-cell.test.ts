import { describe, expect, it } from "vitest";
import { formatNumericCell } from "../format-cell.js";

describe("formatNumericCell", () => {
  it("formats money from integer cents via scale", () => {
    expect(formatNumericCell(16065, { kind: "money", scale: 100 })).toBe("$160.65");
  });

  it("formats thousands-separated numbers", () => {
    expect(formatNumericCell(12345, "number")).toBe("12,345");
  });

  it("renders an em dash for nullish / empty", () => {
    expect(formatNumericCell(null, "number")).toBe("—");
    expect(formatNumericCell("", "money")).toBe("—");
  });

  it("falls back to raw for non-numeric values (no false→0 coercion)", () => {
    expect(formatNumericCell(true, "money")).toBe("true");
  });

  it("normalizes scale <= 0 to 1 (no division by zero)", () => {
    expect(formatNumericCell(5, { kind: "money", scale: 0 })).toBe("$5.00");
  });
});
