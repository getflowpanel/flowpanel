import { describe, expect, it } from "vitest";
import type { PrismaDmmf } from "../introspect";
import { introspect } from "../introspect";

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
            name: "active",
            kind: "scalar",
            type: "Boolean",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: true,
          },
          {
            name: "age",
            kind: "scalar",
            type: "Int",
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
            hasDefault: true,
          },
          {
            name: "tags",
            kind: "scalar",
            type: "String",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: true,
            hasDefault: false,
          },
          {
            name: "metadata",
            kind: "scalar",
            type: "Json",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: false,
            hasDefault: false,
          },
          {
            name: "createdAt",
            kind: "scalar",
            type: "DateTime",
            isId: false,
            isRequired: true,
            isUnique: false,
            isList: false,
            hasDefault: true,
          },
          // relation field — should be skipped
          {
            name: "posts",
            kind: "object",
            type: "Post",
            isId: false,
            isRequired: false,
            isUnique: false,
            isList: true,
            hasDefault: false,
          },
        ],
      },
    ],
    enums: [
      {
        name: "Role",
        values: [{ name: "ADMIN" }, { name: "USER" }, { name: "GUEST" }],
      },
    ],
  },
};

describe("introspect", () => {
  it("maps a User model correctly", () => {
    const result = introspect("User", testDmmf);

    expect(result.name).toBe("User");
    expect(result.primaryKey).toBe("id");

    const byName = Object.fromEntries(result.columns.map((c) => [c.name, c]));

    // relation field must be absent
    expect(byName.posts).toBeUndefined();

    expect(byName.id).toMatchObject({
      name: "id",
      type: "number",
      primaryKey: true,
      readable: true,
      writableOnUpdate: false,
      nullable: false,
    });
    expect(byName.email).toMatchObject({
      name: "email",
      type: "string",
      unique: true,
      nullable: false,
    });
    expect(byName.active).toMatchObject({ name: "active", type: "boolean", nullable: false });
    expect(byName.age).toMatchObject({ name: "age", type: "number", nullable: true });
    expect(byName.role).toMatchObject({ name: "role", type: "enum" });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(byName.role!.enumValues).toEqual(["ADMIN", "USER", "GUEST"]);
    expect(byName.tags).toMatchObject({ name: "tags", type: "array" });
    expect(byName.metadata).toMatchObject({ name: "metadata", type: "json", nullable: true });
    expect(byName.createdAt).toMatchObject({ name: "createdAt", type: "date", nullable: false });
  });

  it("throws for an unknown model, including the list of available models", () => {
    expect(() => introspect("NonExistent", testDmmf)).toThrowError(/NonExistent/);
    expect(() => introspect("NonExistent", testDmmf)).toThrowError(/User/);
  });

  it("memoizes per model: a repeated call does not re-scan the DMMF", () => {
    let scans = 0;
    const counted: PrismaDmmf = {
      get datamodel() {
        scans++;
        return testDmmf.datamodel;
      },
    };

    const first = introspect("User", counted);
    const afterFirst = scans;
    expect(afterFirst).toBeGreaterThan(0);

    expect(introspect("User", counted)).toBe(first);
    expect(scans).toBe(afterFirst);
  });

  it("returns a frozen result so a shared memo entry cannot be mutated", () => {
    const meta = introspect("User", testDmmf);
    expect(Object.isFrozen(meta)).toBe(true);
    expect(Object.isFrozen(meta.columns)).toBe(true);
    expect(Object.isFrozen(meta.columns[0])).toBe(true);
  });
});
