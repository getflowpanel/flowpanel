import { describe, expect, it } from "vitest";
import {
  createFilter,
  filtersToSearchParams,
  mergeFilters,
  searchParamsToFilters,
} from "../filters";
import type { NormalizedFilter } from "../types";

// ---------------------------------------------------------------------------
// createFilter
// ---------------------------------------------------------------------------

describe("createFilter", () => {
  it("creates a NormalizedFilter with the given field, op, value", () => {
    const f = createFilter("email", "eq", "test@example.com");
    expect(f).toEqual<NormalizedFilter>({ field: "email", op: "eq", value: "test@example.com" });
  });

  it("supports isNull op with null value", () => {
    const f = createFilter("deletedAt", "isNull", null);
    expect(f.op).toBe("isNull");
    expect(f.value).toBeNull();
  });

  it("supports in op with array value", () => {
    const f = createFilter("status", "in", ["active", "pending"]);
    expect(f.value).toEqual(["active", "pending"]);
  });
});

// ---------------------------------------------------------------------------
// mergeFilters
// ---------------------------------------------------------------------------

describe("mergeFilters", () => {
  it("returns incoming when existing is empty", () => {
    const incoming = [createFilter("email", "eq", "a@b.com")];
    expect(mergeFilters([], incoming)).toEqual(incoming);
  });

  it("appends new filters that don't match existing field+op", () => {
    const existing = [createFilter("email", "eq", "a@b.com")];
    const incoming = [createFilter("status", "eq", "active")];
    const result = mergeFilters(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it("overrides matching field+op with incoming value", () => {
    const existing = [createFilter("email", "eq", "old@b.com")];
    const incoming = [createFilter("email", "eq", "new@b.com")];
    const result = mergeFilters(existing, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("new@b.com");
  });

  it("handles mixed override and append", () => {
    const existing = [
      createFilter("email", "eq", "old@b.com"),
      createFilter("status", "eq", "active"),
    ];
    const incoming = [
      createFilter("email", "eq", "new@b.com"),
      createFilter("role", "eq", "admin"),
    ];
    const result = mergeFilters(existing, incoming);
    expect(result).toHaveLength(3);
    const emailFilter = result.find((f) => f.field === "email");
    expect(emailFilter?.value).toBe("new@b.com");
  });

  it("same field with different ops are kept as separate entries", () => {
    const existing = [createFilter("amount", "gte", 10)];
    const incoming = [createFilter("amount", "lte", 100)];
    const result = mergeFilters(existing, incoming);
    expect(result).toHaveLength(2);
  });

  it("same field+op incoming overrides even when different ops exist for same field", () => {
    const existing = [
      createFilter("amount", "gte", 10),
      createFilter("amount", "lte", 100),
    ];
    const incoming = [createFilter("amount", "gte", 50)];
    const result = mergeFilters(existing, incoming);
    expect(result).toHaveLength(2);
    const gteFilter = result.find((f) => f.field === "amount" && f.op === "gte");
    expect(gteFilter?.value).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// URL serialization round-trip
// ---------------------------------------------------------------------------

describe("filtersToSearchParams / searchParamsToFilters", () => {
  it("serializes and deserializes a simple string filter", () => {
    const filters = [createFilter("email", "eq", "test@example.com")];
    const params = filtersToSearchParams(filters);
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(filters);
  });

  it("serializes and deserializes multiple filters", () => {
    const filters = [
      createFilter("email", "eq", "a@b.com"),
      createFilter("status", "in", ["active", "pending"]),
    ];
    const params = filtersToSearchParams(filters);
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(filters);
  });

  it("serializes and deserializes null value (isNull)", () => {
    const filters = [createFilter("deletedAt", "isNull", null)];
    const params = filtersToSearchParams(filters);
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(filters);
  });

  it("serializes and deserializes number values", () => {
    const filters = [
      createFilter("amount", "gte", 10),
      createFilter("amount", "lte", 100),
    ];
    const params = filtersToSearchParams(filters);
    const restored = searchParamsToFilters(params);
    expect(restored).toEqual(filters);
  });

  it("returns empty array for empty URLSearchParams", () => {
    const params = new URLSearchParams();
    const result = searchParamsToFilters(params);
    expect(result).toEqual([]);
  });

  it("returns empty params for empty filter array", () => {
    const params = filtersToSearchParams([]);
    expect([...params.entries()]).toHaveLength(0);
  });
});
