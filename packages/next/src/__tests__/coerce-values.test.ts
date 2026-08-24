import type { ColumnMeta } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { coerceRowByColumns } from "../runtime/coerce-values.js";

const columns: ColumnMeta[] = [
  { name: "id", type: "string", nullable: false, unique: true, primaryKey: true },
  { name: "email", type: "string", nullable: false, unique: true, primaryKey: false },
  { name: "age", type: "number", nullable: true, unique: false, primaryKey: false },
  { name: "active", type: "boolean", nullable: false, unique: false, primaryKey: false },
  { name: "bornAt", type: "date", nullable: true, unique: false, primaryKey: false },
];

describe("coerceRowByColumns", () => {
  it("converts a numeric string to a number", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { age: "42" });
    expect(values.age).toBe(42);
    expect(fieldErrors).toEqual({});
  });

  it("converts true/false, 1/0, case-insensitively, to booleans", () => {
    expect(coerceRowByColumns(columns, { active: "true" }).values.active).toBe(true);
    expect(coerceRowByColumns(columns, { active: "FALSE" }).values.active).toBe(false);
    expect(coerceRowByColumns(columns, { active: "1" }).values.active).toBe(true);
    expect(coerceRowByColumns(columns, { active: "0" }).values.active).toBe(false);
  });

  it("converts a date string to a Date instance", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { bornAt: "2024-01-15" });
    expect(values.bornAt).toBeInstanceOf(Date);
    expect((values.bornAt as Date).getTime()).toBe(new Date("2024-01-15").getTime());
    expect(fieldErrors).toEqual({});
  });

  it("nulls an empty string on a nullable column", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { age: "", bornAt: "" });
    expect(values).toEqual({ age: null, bornAt: null });
    expect(fieldErrors).toEqual({});
  });

  it("omits an empty string on a NOT NULL column so a database default can apply", () => {
    // Sending `null` for a NOT NULL column is never right: the column either has
    // a default, in which case omitting lets it apply, or it has none, in which
    // case the insert schema reports it as required rather than "Invalid input".
    const { values, fieldErrors } = coerceRowByColumns(columns, {
      email: "a@b.c",
      active: "",
    });
    expect(values).toEqual({ email: "a@b.c" });
    expect("active" in values).toBe(false);
    expect(fieldErrors).toEqual({});
  });

  it("produces a per-field error for an unparseable number instead of NaN", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { age: "not-a-number" });
    expect(fieldErrors.age).toMatch(/not a valid number/);
    // The raw, un-coerced value must NOT survive into `values` as NaN.
    expect(Number.isNaN(values.age)).toBe(false);
    expect(values.age).toBe("not-a-number");
  });

  it("produces a per-field error for an unparseable boolean", () => {
    const { fieldErrors } = coerceRowByColumns(columns, { active: "maybe" });
    expect(fieldErrors.active).toMatch(/not a valid boolean/);
  });

  it("produces a per-field error for an unparseable date", () => {
    const { fieldErrors } = coerceRowByColumns(columns, { bornAt: "not-a-date" });
    expect(fieldErrors.bornAt).toMatch(/not a valid date/);
  });

  it("leaves string/unknown-kind columns untouched", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { email: "a@b.com" });
    expect(values.email).toBe("a@b.com");
    expect(fieldErrors).toEqual({});
  });

  it("leaves values that are already the right JS type alone (JSON import path)", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { age: 42, active: true });
    expect(values.age).toBe(42);
    expect(values.active).toBe(true);
    expect(fieldErrors).toEqual({});
  });

  it("passes through keys with no matching column unchanged", () => {
    const { values, fieldErrors } = coerceRowByColumns(columns, { unknownField: "x" });
    expect(values.unknownField).toBe("x");
    expect(fieldErrors).toEqual({});
  });
});
