import { describe, it, expect } from "vitest";
import { extractModelsFromDmmf, extractEnumsFromDmmf } from "../metadata";

const baseDmmf = {
  datamodel: {
    enums: [
      {
        name: "Role",
        values: [{ name: "ADMIN" }, { name: "USER" }, { name: "GUEST" }],
      },
    ],
    models: [
      {
        name: "User",
        dbName: "users",
        fields: [
          {
            name: "id",
            kind: "scalar" as const,
            type: "String",
            isRequired: true,
            isList: false,
            isId: true,
            isReadOnly: false,
            hasDefaultValue: true,
            default: { name: "cuid", args: [] },
          },
          {
            name: "email",
            kind: "scalar" as const,
            type: "String",
            isRequired: true,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "age",
            kind: "scalar" as const,
            type: "Int",
            isRequired: false,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "score",
            kind: "scalar" as const,
            type: "Float",
            isRequired: false,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "active",
            kind: "scalar" as const,
            type: "Boolean",
            isRequired: true,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: true,
            default: true,
          },
          {
            name: "createdAt",
            kind: "scalar" as const,
            type: "DateTime",
            isRequired: true,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: true,
            default: { name: "now", args: [] },
          },
          {
            name: "updatedAt",
            kind: "scalar" as const,
            type: "DateTime",
            isRequired: true,
            isList: false,
            isId: false,
            isReadOnly: false,
            isUpdatedAt: true,
            hasDefaultValue: false,
          },
          {
            name: "metadata",
            kind: "scalar" as const,
            type: "Json",
            isRequired: false,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "bigNum",
            kind: "scalar" as const,
            type: "BigInt",
            isRequired: false,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "price",
            kind: "scalar" as const,
            type: "Decimal",
            isRequired: false,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
          },
          {
            name: "role",
            kind: "enum" as const,
            type: "Role",
            isRequired: true,
            isList: false,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: true,
            default: "USER",
          },
          {
            name: "posts",
            kind: "object" as const,
            type: "Post",
            isRequired: false,
            isList: true,
            isId: false,
            isReadOnly: false,
            hasDefaultValue: false,
            relationName: "PostToUser",
          },
        ],
      },
    ],
  },
};

describe("extractEnumsFromDmmf", () => {
  it("extracts enum names and values", () => {
    const enums = extractEnumsFromDmmf(baseDmmf);
    expect(enums.get("Role")).toEqual(["ADMIN", "USER", "GUEST"]);
  });

  it("returns empty map when no enums", () => {
    const enums = extractEnumsFromDmmf({ datamodel: { models: [], enums: [] } });
    expect(enums.size).toBe(0);
  });
});

describe("extractModelsFromDmmf", () => {
  const models = extractModelsFromDmmf(baseDmmf);
  const user = models.get("User")!;

  it("extracts model name and tableName", () => {
    expect(user.name).toBe("User");
    expect(user.tableName).toBe("users");
  });

  it("sets primaryKey to id field", () => {
    expect(user.primaryKey).toBe("id");
  });

  it("maps String → string scalar", () => {
    const f = user.fields.find((f) => f.name === "email")!;
    expect(f.type).toBe("string");
    expect(f.kind).toBe("scalar");
  });

  it("maps Int → int scalar", () => {
    const f = user.fields.find((f) => f.name === "age")!;
    expect(f.type).toBe("int");
    expect(f.kind).toBe("scalar");
  });

  it("maps BigInt → int scalar", () => {
    const f = user.fields.find((f) => f.name === "bigNum")!;
    expect(f.type).toBe("int");
    expect(f.kind).toBe("scalar");
  });

  it("maps Float → float scalar", () => {
    const f = user.fields.find((f) => f.name === "score")!;
    expect(f.type).toBe("float");
    expect(f.kind).toBe("scalar");
  });

  it("maps Decimal → float scalar", () => {
    const f = user.fields.find((f) => f.name === "price")!;
    expect(f.type).toBe("float");
    expect(f.kind).toBe("scalar");
  });

  it("maps Boolean → boolean scalar", () => {
    const f = user.fields.find((f) => f.name === "active")!;
    expect(f.type).toBe("boolean");
    expect(f.kind).toBe("scalar");
  });

  it("maps DateTime → datetime scalar", () => {
    const f = user.fields.find((f) => f.name === "createdAt")!;
    expect(f.type).toBe("datetime");
    expect(f.kind).toBe("scalar");
  });

  it("maps Json → json scalar", () => {
    const f = user.fields.find((f) => f.name === "metadata")!;
    expect(f.type).toBe("json");
    expect(f.kind).toBe("scalar");
  });

  it("maps enum field → enum kind with enumValues", () => {
    const f = user.fields.find((f) => f.name === "role")!;
    expect(f.type).toBe("enum");
    expect(f.kind).toBe("enum");
    expect(f.enumValues).toEqual(["ADMIN", "USER", "GUEST"]);
  });

  it("maps object/relation field → relation kind with relationModel", () => {
    const f = user.fields.find((f) => f.name === "posts")!;
    expect(f.type).toBe("relation");
    expect(f.kind).toBe("relation");
    expect(f.relationModel).toBe("Post");
  });

  describe("isAutoGenerated", () => {
    it("id field is auto-generated", () => {
      const f = user.fields.find((f) => f.name === "id")!;
      expect(f.isAutoGenerated).toBe(true);
    });

    it("updatedAt (isUpdatedAt=true) is auto-generated", () => {
      const f = user.fields.find((f) => f.name === "updatedAt")!;
      expect(f.isAutoGenerated).toBe(true);
    });

    it("createdAt with default is auto-generated", () => {
      const f = user.fields.find((f) => f.name === "createdAt")!;
      expect(f.isAutoGenerated).toBe(true);
    });

    it("regular field is not auto-generated", () => {
      const f = user.fields.find((f) => f.name === "email")!;
      expect(f.isAutoGenerated).toBe(false);
    });
  });

  it("falls back to 'id' as primaryKey when no isId field", () => {
    const dmmf = {
      datamodel: {
        enums: [],
        models: [
          {
            name: "Widget",
            dbName: null,
            fields: [
              {
                name: "name",
                kind: "scalar" as const,
                type: "String",
                isRequired: true,
                isList: false,
                isId: false,
                isReadOnly: false,
                hasDefaultValue: false,
              },
            ],
          },
        ],
      },
    };
    const m = extractModelsFromDmmf(dmmf).get("Widget")!;
    expect(m.primaryKey).toBe("id");
  });

  it("tableName is undefined when dbName is null", () => {
    const dmmf = {
      datamodel: {
        enums: [],
        models: [
          {
            name: "Widget",
            dbName: null,
            fields: [],
          },
        ],
      },
    };
    const m = extractModelsFromDmmf(dmmf).get("Widget")!;
    expect(m.tableName).toBeUndefined();
  });
});
