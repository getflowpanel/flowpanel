import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock drizzle-orm operators
// We capture calls to verify that the right operator is called with the
// right column and value, without needing a real database.
// ---------------------------------------------------------------------------

vi.mock("drizzle-orm", () => {
  function makeOp(name: string) {
    return vi.fn((...args: unknown[]) => ({ __op: name, args }));
  }

  const eq = makeOp("eq");
  const ne = makeOp("ne");
  const ilike = makeOp("ilike");
  const like = makeOp("like");
  const inArray = makeOp("inArray");
  const notInArray = makeOp("notInArray");
  const gte = makeOp("gte");
  const lte = makeOp("lte");
  const gt = makeOp("gt");
  const lt = makeOp("lt");
  const isNull = makeOp("isNull");
  const isNotNull = makeOp("isNotNull");
  const and = vi.fn((...conditions: unknown[]) => ({ __op: "and", conditions }));

  return { eq, ne, like, ilike, inArray, notInArray, gte, lte, gt, lt, isNull, isNotNull, and };
});

// Now import after mock is set up
import {
  eq,
  ne,
  ilike,
  inArray,
  notInArray,
  gte,
  lte,
  gt,
  lt,
  isNull,
  isNotNull,
  and,
} from "drizzle-orm";
import { normalizedFiltersToDrizzleWhere } from "../filters";
import type { NormalizedFilter } from "@flowpanel/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTable(columns: string[]): Record<string, { __col: string }> {
  const table: Record<string, { __col: string }> = {};
  for (const col of columns) {
    table[col] = { __col: col };
  }
  return table;
}

function filter(
  field: string,
  op: NormalizedFilter["op"],
  value: unknown = null,
): NormalizedFilter {
  return { field, op, value };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("normalizedFiltersToDrizzleWhere", () => {
  it("returns undefined for empty filters", () => {
    const table = makeTable(["id", "email"]);
    const result = normalizedFiltersToDrizzleWhere([], table);
    expect(result).toBeUndefined();
  });

  it("translates eq filter", () => {
    const table = makeTable(["email"]);
    normalizedFiltersToDrizzleWhere([filter("email", "eq", "test@example.com")], table);
    expect(eq).toHaveBeenCalledWith(table.email, "test@example.com");
  });

  it("translates neq filter", () => {
    const table = makeTable(["status"]);
    normalizedFiltersToDrizzleWhere([filter("status", "neq", "inactive")], table);
    expect(ne).toHaveBeenCalledWith(table.status, "inactive");
  });

  it("translates contains filter using ilike", () => {
    const table = makeTable(["name"]);
    normalizedFiltersToDrizzleWhere([filter("name", "contains", "foo")], table);
    expect(ilike).toHaveBeenCalledWith(table.name, "%foo%");
  });

  it("translates startsWith filter using ilike", () => {
    const table = makeTable(["name"]);
    normalizedFiltersToDrizzleWhere([filter("name", "startsWith", "bar")], table);
    expect(ilike).toHaveBeenCalledWith(table.name, "bar%");
  });

  it("translates endsWith filter using ilike", () => {
    const table = makeTable(["name"]);
    normalizedFiltersToDrizzleWhere([filter("name", "endsWith", "baz")], table);
    expect(ilike).toHaveBeenCalledWith(table.name, "%baz");
  });

  it("translates in filter", () => {
    const table = makeTable(["role"]);
    normalizedFiltersToDrizzleWhere([filter("role", "in", ["admin", "editor"])], table);
    expect(inArray).toHaveBeenCalledWith(table.role, ["admin", "editor"]);
  });

  it("translates notIn filter", () => {
    const table = makeTable(["status"]);
    normalizedFiltersToDrizzleWhere([filter("status", "notIn", ["deleted"])], table);
    expect(notInArray).toHaveBeenCalledWith(table.status, ["deleted"]);
  });

  it("translates gte filter", () => {
    const table = makeTable(["age"]);
    normalizedFiltersToDrizzleWhere([filter("age", "gte", 18)], table);
    expect(gte).toHaveBeenCalledWith(table.age, 18);
  });

  it("translates lte filter", () => {
    const table = makeTable(["age"]);
    normalizedFiltersToDrizzleWhere([filter("age", "lte", 65)], table);
    expect(lte).toHaveBeenCalledWith(table.age, 65);
  });

  it("translates gt filter", () => {
    const table = makeTable(["score"]);
    normalizedFiltersToDrizzleWhere([filter("score", "gt", 0)], table);
    expect(gt).toHaveBeenCalledWith(table.score, 0);
  });

  it("translates lt filter", () => {
    const table = makeTable(["score"]);
    normalizedFiltersToDrizzleWhere([filter("score", "lt", 100)], table);
    expect(lt).toHaveBeenCalledWith(table.score, 100);
  });

  it("translates isNull filter", () => {
    const table = makeTable(["deletedAt"]);
    normalizedFiltersToDrizzleWhere([filter("deletedAt", "isNull")], table);
    expect(isNull).toHaveBeenCalledWith(table.deletedAt);
  });

  it("translates isNotNull filter", () => {
    const table = makeTable(["verifiedAt"]);
    normalizedFiltersToDrizzleWhere([filter("verifiedAt", "isNotNull")], table);
    expect(isNotNull).toHaveBeenCalledWith(table.verifiedAt);
  });

  it("combines multiple filters with AND", () => {
    const table = makeTable(["age", "status"]);
    normalizedFiltersToDrizzleWhere(
      [filter("age", "gte", 18), filter("status", "eq", "active")],
      table,
    );
    expect(and).toHaveBeenCalledTimes(1);
    expect(and).toHaveBeenCalledWith(expect.anything(), expect.anything());
  });

  it("returns single condition directly (no AND wrapper) for single filter", () => {
    const table = makeTable(["email"]);
    const result = normalizedFiltersToDrizzleWhere([filter("email", "eq", "x@y.com")], table);
    // Should not call and() for a single condition
    expect(and).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("skips nested dot-path filters with a warning", () => {
    const table = makeTable(["email"]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = normalizedFiltersToDrizzleWhere([filter("user.email", "eq", "x@y.com")], table);
    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("nested filter path"));
    warnSpy.mockRestore();
  });

  it("skips unknown columns with a warning", () => {
    const table = makeTable(["email"]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = normalizedFiltersToDrizzleWhere(
      [filter("nonExistentColumn", "eq", "value")],
      table,
    );
    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("nonExistentColumn"));
    warnSpy.mockRestore();
  });

  it("applies valid filters even when some are skipped", () => {
    const table = makeTable(["status"]);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    normalizedFiltersToDrizzleWhere(
      [filter("user.email", "eq", "x"), filter("status", "eq", "active")],
      table,
    );
    expect(eq).toHaveBeenCalledWith(table.status, "active");
    warnSpy.mockRestore();
  });
});
