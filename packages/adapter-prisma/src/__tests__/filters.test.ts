import { describe, it, expect } from "vitest";
import { normalizedFiltersToPrismaWhere } from "../filters";
import type { NormalizedFilter } from "@flowpanel/core";

describe("normalizedFiltersToPrismaWhere", () => {
  it("returns empty object for empty filters", () => {
    expect(normalizedFiltersToPrismaWhere([])).toEqual({});
  });

  it("eq: simple equality", () => {
    const filters: NormalizedFilter[] = [{ field: "status", op: "eq", value: "active" }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ status: "active" });
  });

  it("eq: boolean equality", () => {
    const filters: NormalizedFilter[] = [{ field: "active", op: "eq", value: true }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ active: true });
  });

  it("neq: not equal", () => {
    const filters: NormalizedFilter[] = [{ field: "status", op: "neq", value: "deleted" }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ status: { not: "deleted" } });
  });

  it("in: in array", () => {
    const filters: NormalizedFilter[] = [
      { field: "status", op: "in", value: ["active", "pending"] },
    ];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
      status: { in: ["active", "pending"] },
    });
  });

  it("notIn: not in array", () => {
    const filters: NormalizedFilter[] = [
      { field: "status", op: "notIn", value: ["deleted", "banned"] },
    ];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
      status: { notIn: ["deleted", "banned"] },
    });
  });

  it("contains: insensitive substring", () => {
    const filters: NormalizedFilter[] = [{ field: "email", op: "contains", value: "foo" }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
      email: { contains: "foo", mode: "insensitive" },
    });
  });

  it("startsWith: insensitive prefix", () => {
    const filters: NormalizedFilter[] = [{ field: "name", op: "startsWith", value: "Al" }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
      name: { startsWith: "Al", mode: "insensitive" },
    });
  });

  it("endsWith: insensitive suffix", () => {
    const filters: NormalizedFilter[] = [{ field: "name", op: "endsWith", value: "son" }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
      name: { endsWith: "son", mode: "insensitive" },
    });
  });

  it("gte: greater than or equal", () => {
    const filters: NormalizedFilter[] = [{ field: "price", op: "gte", value: 100 }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ price: { gte: 100 } });
  });

  it("lte: less than or equal", () => {
    const filters: NormalizedFilter[] = [{ field: "price", op: "lte", value: 500 }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ price: { lte: 500 } });
  });

  it("gt: greater than", () => {
    const filters: NormalizedFilter[] = [{ field: "price", op: "gt", value: 100 }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ price: { gt: 100 } });
  });

  it("lt: less than", () => {
    const filters: NormalizedFilter[] = [{ field: "price", op: "lt", value: 500 }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ price: { lt: 500 } });
  });

  it("isNull: null check", () => {
    const filters: NormalizedFilter[] = [{ field: "deletedAt", op: "isNull", value: undefined }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ deletedAt: null });
  });

  it("isNotNull: not null check", () => {
    const filters: NormalizedFilter[] = [{ field: "deletedAt", op: "isNotNull", value: undefined }];
    expect(normalizedFiltersToPrismaWhere(filters)).toEqual({ deletedAt: { not: null } });
  });

  describe("nested (dot-path) filters", () => {
    it("translates user.email contains to nested object", () => {
      const filters: NormalizedFilter[] = [{ field: "user.email", op: "contains", value: "foo" }];
      expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
        user: { email: { contains: "foo", mode: "insensitive" } },
      });
    });

    it("translates 3-level dot path", () => {
      const filters: NormalizedFilter[] = [
        { field: "order.user.email", op: "eq", value: "a@b.com" },
      ];
      expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
        order: { user: { email: "a@b.com" } },
      });
    });
  });

  describe("multiple filters merge with AND semantics", () => {
    it("two filters on different fields", () => {
      const filters: NormalizedFilter[] = [
        { field: "status", op: "eq", value: "active" },
        { field: "age", op: "gte", value: 18 },
      ];
      expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
        status: "active",
        age: { gte: 18 },
      });
    });

    it("two filters on same field merge into single object", () => {
      const filters: NormalizedFilter[] = [
        { field: "price", op: "gte", value: 10 },
        { field: "price", op: "lte", value: 100 },
      ];
      expect(normalizedFiltersToPrismaWhere(filters)).toEqual({
        price: { gte: 10, lte: 100 },
      });
    });
  });
});
