import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { reexportedFrom } from "../config-target";
import { describeSchema, labelField } from "../describe-schema";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "fixtures/project");

describe("describeSchema", () => {
  it("describes every table with its columns in declaration order", async () => {
    const tables = await describeSchema(PROJECT, join(PROJECT, "db/schema.ts"));
    expect(tables.map((t) => [t.exportName, t.tableName])).toEqual([
      ["user", "user"],
      ["userVisit", "user_visit"],
      ["invoice", "invoice"],
    ]);
    const visit = tables[1];
    expect(visit?.columns.map((c) => c.key)).toEqual([
      "id",
      "userId",
      "surface",
      "startedAt",
      "day",
      "firstPath",
      "meta",
      "description",
      "touches",
    ]);
  });

  it("reads references from the table's foreign keys, labelled by name before title and email", async () => {
    const [, visit] = await describeSchema(PROJECT, join(PROJECT, "db/schema.ts"));
    expect(visit?.columns.find((c) => c.key === "userId")?.references).toEqual({
      table: "user",
      labelField: "name",
    });
  });

  it("reads a composite foreign key as a reference on the column that meets the primary key", async () => {
    const [, , invoice] = await describeSchema(PROJECT, join(PROJECT, "db/schema.ts"));
    expect(invoice?.columns.find((c) => c.key === "userId")?.references).toEqual({
      table: "user",
      labelField: "name",
    });
    expect(invoice?.columns.find((c) => c.key === "workspaceId")?.references).toBeUndefined();
  });

  it("finds the pgEnum export and the varchar length", async () => {
    const [, visit] = await describeSchema(PROJECT, join(PROJECT, "db/schema.ts"));
    expect(visit?.columns.find((c) => c.key === "surface")).toMatchObject({
      enumValues: ["web", "tma"],
      enumExport: "activitySurface",
    });
    expect(visit?.columns.find((c) => c.key === "firstPath")?.length).toBe(160);
  });
});

describe("labelField", () => {
  it("prefers a NOT NULL name, title or email, so no row reads as its raw key", () => {
    const columns = [
      { key: "name", dataType: "string", notNull: false },
      { key: "email", dataType: "string", notNull: true },
    ];
    expect(labelField(columns, "id")).toBe("email");
    expect(labelField(columns.slice(0, 1), "id")).toBe("name");
    expect(labelField([{ key: "total", dataType: "number" }], "id")).toBe("id");
  });
});

describe("reexportedFrom", () => {
  it("follows a one-line default re-export and nothing else", () => {
    expect(reexportedFrom('export { default } from "@admin/config";\n')).toBe("@admin/config");
    expect(reexportedFrom("export { default } from './admin/config'")).toBe("./admin/config");
    expect(
      reexportedFrom('import x from "a";\nexport { default } from "@admin/config";'),
    ).toBeNull();
  });
});
