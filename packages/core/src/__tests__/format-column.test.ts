import { describe, expect, it } from "vitest";
import { formatColumnValue } from "../format-column";

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
