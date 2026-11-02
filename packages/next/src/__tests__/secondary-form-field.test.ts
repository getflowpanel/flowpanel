import type { ColumnMeta, ResourceConfig } from "@flowpanel/core";
import { describe, expect, it } from "vitest";
import { writableColumns } from "../actions/field-pipeline";

const column = (name: string): ColumnMeta => ({
  name,
  type: "string",
  nullable: false,
  unique: false,
  primaryKey: name === "id",
});

describe("the generated form", () => {
  it("offers a column the list shows only as a secondary line", () => {
    const resource = {
      __kind: "resource",
      ref: { __name: "products" },
      options: { columns: [{ field: "name", secondary: "sku" }, "price"] },
    } as unknown as ResourceConfig;
    const columns = ["id", "name", "sku", "price", "notes"].map(column);
    expect(writableColumns(resource, columns, undefined).map((c) => c.name)).toEqual([
      "name",
      "sku",
      "price",
    ]);
  });
});
