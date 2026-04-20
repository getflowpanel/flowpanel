import { describe, it, expect } from "vitest";
import { extractModelFromDrizzleTable } from "../metadata";

// ---------------------------------------------------------------------------
// Helpers to build mock Drizzle column/table objects
// ---------------------------------------------------------------------------

function makeColumn(overrides: {
  name: string;
  dataType: string;
  columnType: string;
  notNull?: boolean;
  hasDefault?: boolean;
  primary?: boolean;
  isAutoincrement?: boolean;
  enumValues?: string[];
}) {
  return {
    name: overrides.name,
    dataType: overrides.dataType,
    columnType: overrides.columnType,
    notNull: overrides.notNull ?? false,
    hasDefault: overrides.hasDefault ?? false,
    primary: overrides.primary ?? false,
    isAutoincrement: overrides.isAutoincrement,
    enumValues: overrides.enumValues,
  };
}

/**
 * Build a mock Drizzle table exposing columns via the `_` property,
 * which is the internal Drizzle API pattern.
 */
function makeTable(columns: ReturnType<typeof makeColumn>[], tableName?: string) {
  const colMap: Record<string, unknown> = {};
  for (const col of columns) {
    colMap[col.name] = col;
  }
  return {
    _: {
      name: tableName ?? "mock_table",
      columns: colMap,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extractModelFromDrizzleTable", () => {
  it("maps string dataType to string scalar", () => {
    const table = makeTable([
      makeColumn({ name: "id", dataType: "string", columnType: "PgVarchar", primary: true }),
      makeColumn({ name: "email", dataType: "string", columnType: "PgText", notNull: true }),
    ]);

    const meta = extractModelFromDrizzleTable("User", table);
    expect(meta.name).toBe("User");
    expect(meta.primaryKey).toBe("id");

    const idField = meta.fields.find((f) => f.name === "id")!;
    expect(idField.type).toBe("string");
    expect(idField.kind).toBe("scalar");
    expect(idField.isId).toBe(true);

    const emailField = meta.fields.find((f) => f.name === "email")!;
    expect(emailField.type).toBe("string");
    expect(emailField.kind).toBe("scalar");
    expect(emailField.isRequired).toBe(true);
  });

  it("maps number dataType to int by default", () => {
    const table = makeTable([
      makeColumn({ name: "id", dataType: "number", columnType: "PgInteger", primary: true }),
      makeColumn({ name: "count", dataType: "number", columnType: "PgInteger", notNull: true }),
    ]);

    const meta = extractModelFromDrizzleTable("Counter", table);
    const idField = meta.fields.find((f) => f.name === "id")!;
    expect(idField.type).toBe("int");
    expect(idField.kind).toBe("scalar");
  });

  it("maps float columnType to float", () => {
    const table = makeTable([
      makeColumn({ name: "price", dataType: "number", columnType: "PgNumeric", notNull: true }),
    ]);

    const meta = extractModelFromDrizzleTable("Product", table);
    const priceField = meta.fields.find((f) => f.name === "price")!;
    expect(priceField.type).toBe("float");
    expect(priceField.kind).toBe("scalar");
  });

  it("maps boolean dataType to boolean scalar", () => {
    const table = makeTable([
      makeColumn({ name: "active", dataType: "boolean", columnType: "PgBoolean", notNull: true }),
    ]);

    const meta = extractModelFromDrizzleTable("Item", table);
    const field = meta.fields.find((f) => f.name === "active")!;
    expect(field.type).toBe("boolean");
    expect(field.kind).toBe("scalar");
  });

  it("maps date dataType to datetime scalar", () => {
    const table = makeTable([
      makeColumn({
        name: "createdAt",
        dataType: "date",
        columnType: "PgTimestamp",
        hasDefault: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("Record", table);
    const field = meta.fields.find((f) => f.name === "createdAt")!;
    expect(field.type).toBe("datetime");
    expect(field.kind).toBe("scalar");
  });

  it("maps json dataType to json scalar", () => {
    const table = makeTable([
      makeColumn({ name: "metadata", dataType: "json", columnType: "PgJson" }),
    ]);

    const meta = extractModelFromDrizzleTable("Record", table);
    const field = meta.fields.find((f) => f.name === "metadata")!;
    expect(field.type).toBe("json");
    expect(field.kind).toBe("scalar");
  });

  it("detects enum columns from enumValues", () => {
    const table = makeTable([
      makeColumn({
        name: "status",
        dataType: "string",
        columnType: "PgEnumColumn",
        enumValues: ["active", "inactive", "pending"],
        notNull: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("User", table);
    const field = meta.fields.find((f) => f.name === "status")!;
    expect(field.type).toBe("enum");
    expect(field.kind).toBe("enum");
    expect(field.enumValues).toEqual(["active", "inactive", "pending"]);
  });

  it("marks primary key as isAutoGenerated", () => {
    const table = makeTable([
      makeColumn({ name: "id", dataType: "number", columnType: "PgSerial", primary: true }),
    ]);

    const meta = extractModelFromDrizzleTable("User", table);
    const field = meta.fields.find((f) => f.name === "id")!;
    expect(field.isId).toBe(true);
    expect(field.isAutoGenerated).toBe(true);
  });

  it("marks autoincrement columns as isAutoGenerated", () => {
    const table = makeTable([
      makeColumn({
        name: "id",
        dataType: "number",
        columnType: "SqliteInteger",
        isAutoincrement: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("Widget", table);
    const field = meta.fields.find((f) => f.name === "id")!;
    expect(field.isAutoGenerated).toBe(true);
  });

  it("marks createdAt with default as isAutoGenerated", () => {
    const table = makeTable([
      makeColumn({
        name: "createdAt",
        dataType: "date",
        columnType: "PgTimestamp",
        hasDefault: true,
        notNull: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("Log", table);
    const field = meta.fields.find((f) => f.name === "createdAt")!;
    expect(field.isAutoGenerated).toBe(true);
  });

  it("marks updatedAt with default as isAutoGenerated", () => {
    const table = makeTable([
      makeColumn({
        name: "updatedAt",
        dataType: "date",
        columnType: "PgTimestamp",
        hasDefault: true,
        notNull: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("Log", table);
    const field = meta.fields.find((f) => f.name === "updatedAt")!;
    expect(field.isAutoGenerated).toBe(true);
  });

  it("does NOT mark a regular column with default as isAutoGenerated", () => {
    const table = makeTable([
      makeColumn({
        name: "role",
        dataType: "string",
        columnType: "PgVarchar",
        hasDefault: true,
        notNull: true,
      }),
    ]);

    const meta = extractModelFromDrizzleTable("User", table);
    const field = meta.fields.find((f) => f.name === "role")!;
    expect(field.isAutoGenerated).toBe(false);
  });

  it("includes tableName when different from model name", () => {
    const table = makeTable([], "users_table");
    const meta = extractModelFromDrizzleTable("User", table);
    expect(meta.tableName).toBe("users_table");
  });

  it("falls back to 'id' as primaryKey when no primary column", () => {
    const table = makeTable([
      makeColumn({ name: "email", dataType: "string", columnType: "PgText", notNull: true }),
    ]);

    const meta = extractModelFromDrizzleTable("User", table);
    expect(meta.primaryKey).toBe("id");
  });

  it("falls back to direct property scanning when _.columns is absent", () => {
    // Table without `_` — columns exposed as direct properties
    const col = makeColumn({
      name: "id",
      dataType: "string",
      columnType: "PgVarchar",
      primary: true,
    });
    const table = { id: col };

    const meta = extractModelFromDrizzleTable("Direct", table);
    expect(meta.fields.length).toBe(1);
    expect(meta.fields[0]!.name).toBe("id");
    expect(meta.primaryKey).toBe("id");
  });

  it("handles bigint dataType as int", () => {
    const table = makeTable([
      makeColumn({ name: "id", dataType: "bigint", columnType: "PgBigInt", primary: true }),
    ]);

    const meta = extractModelFromDrizzleTable("BigRecord", table);
    const field = meta.fields.find((f) => f.name === "id")!;
    expect(field.type).toBe("int");
  });
});
