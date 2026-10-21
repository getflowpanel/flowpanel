import { describe, expect, it } from "vitest";
import type { PrismaDmmf } from "../introspect";
import { inferSchema } from "../schema";

const testDmmf: PrismaDmmf = {
  datamodel: {
    models: [
      {
        name: "User",
        fields: [
          {
            name: "id",
            kind: "scalar",
            type: "Int",
            isId: true,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefaultValue: true,
          },
          {
            name: "email",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: true,
            isList: false,
            hasDefaultValue: false,
          },
          {
            name: "name",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: false,
            hasDefaultValue: false,
          },
          {
            name: "role",
            kind: "enum",
            type: "Role",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefaultValue: false,
          },
        ],
      },
    ],
    enums: [
      {
        name: "Role",
        values: [{ name: "ADMIN" }, { name: "USER" }],
      },
    ],
  },
};

describe("inferSchema", () => {
  it("create schema requires non-id required fields (throws on {}, accepts full set)", () => {
    const { create } = inferSchema("User", testDmmf);

    // Missing required `email` and `role` — should fail
    expect(() => (create as any).parse({})).toThrow();

    // Full valid object (no id since it's omitted from create)
    expect(() =>
      (create as any).parse({ email: "alice@example.com", role: "ADMIN" }),
    ).not.toThrow();
  });

  it("update schema accepts partial (both {} and {email} pass)", () => {
    const { update } = inferSchema("User", testDmmf);

    expect(() => (update as any).parse({})).not.toThrow();
    expect(() => (update as any).parse({ email: "bob@example.com" })).not.toThrow();
  });

  it("enum values are validated in create schema", () => {
    const { create } = inferSchema("User", testDmmf);

    // Valid enum value
    expect(() => (create as any).parse({ email: "test@example.com", role: "ADMIN" })).not.toThrow();

    // Invalid enum value
    expect(() => (create as any).parse({ email: "test@example.com", role: "SUPERUSER" })).toThrow();
  });
});

const field = (name: string, type: string, isRequired: boolean) => ({
  name,
  kind: "scalar" as const,
  type,
  isId: name === "id",
  isRequired,
  isUnique: name === "id",
  isList: false,
  hasDefaultValue: false,
});

const eventsDmmf: PrismaDmmf = {
  datamodel: {
    models: [
      {
        name: "Event",
        fields: [
          field("id", "Int", true),
          field("at", "DateTime", true),
          field("endedAt", "DateTime", false),
        ],
      },
    ],
    enums: [],
  },
};

describe("a DateTime field", () => {
  const { update } = inferSchema("Event", eventsDmmf);
  const parsed = (value: unknown, name = "at") => update.safeParse({ [name]: value });

  it("takes a Date, ISO 8601 text with an offset, or a calendar day", () => {
    expect(parsed(new Date("2026-10-18T22:30:00Z")).data).toEqual({
      at: new Date("2026-10-18T22:30:00Z"),
    });
    expect(parsed("2026-10-18T22:30:00.000Z").data).toEqual({
      at: new Date("2026-10-18T22:30:00Z"),
    });
    expect(parsed("2026-10-19T01:30:00+03:00").data).toEqual({
      at: new Date("2026-10-18T22:30:00Z"),
    });
    expect(parsed("2026-10-18").data).toEqual({ at: new Date("2026-10-18T00:00:00Z") });
  });

  it("refuses null on a required field, and a number, a boolean or text without a zone anywhere", () => {
    for (const value of [null, true, 0, "1", "2026-10-18T22:30", "soon"]) {
      expect(parsed(value).success).toBe(false);
    }
    expect(parsed(null, "endedAt").data).toEqual({ endedAt: null });
    expect(parsed(0, "endedAt").success).toBe(false);
  });
});
