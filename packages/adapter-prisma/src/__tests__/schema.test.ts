import { describe, expect, it } from "vitest";
import { inferSchema } from "../schema.js";
import type { PrismaDmmf } from "../introspect.js";

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
            hasDefault: true,
          },
          {
            name: "email",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: true,
            isList: false,
            hasDefault: false,
          },
          {
            name: "name",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: false,
            hasDefault: false,
          },
          {
            name: "role",
            kind: "enum",
            type: "Role",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: false,
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
