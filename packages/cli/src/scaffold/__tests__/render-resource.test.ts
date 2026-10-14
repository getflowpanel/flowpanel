import { describe, expect, it } from "vitest";
import type { TableDescription } from "../describe-schema";
import { columnKind, fileBaseOf, renderResourceFile } from "../render-resource";

const USER_VISIT: TableDescription = {
  exportName: "userVisit",
  tableName: "user_visit",
  columns: [
    { key: "id", dataType: "string", columnType: "PgText", primary: true },
    {
      key: "userId",
      dataType: "string",
      columnType: "PgText",
      primary: false,
      references: { table: "user", labelField: "name" },
    },
    {
      key: "surface",
      dataType: "string",
      columnType: "PgEnumColumn",
      primary: false,
      enumValues: ["web", "tma"],
      enumExport: "activitySurface",
    },
    { key: "startedAt", dataType: "date", columnType: "PgTimestamp", primary: false },
    { key: "day", dataType: "string", columnType: "PgDateString", primary: false },
    { key: "firstPath", dataType: "string", columnType: "PgVarchar", primary: false, length: 160 },
    { key: "meta", dataType: "json", columnType: "PgJsonb", primary: false },
    { key: "description", dataType: "string", columnType: "PgText", primary: false },
    { key: "touches", dataType: "number", columnType: "PgInteger", primary: false },
  ],
};

const USER: TableDescription = {
  exportName: "user",
  tableName: "user",
  columns: [
    { key: "id", dataType: "string", columnType: "PgText", primary: true },
    { key: "name", dataType: "string", columnType: "PgText", primary: false },
    { key: "email", dataType: "string", columnType: "PgText", primary: false },
    { key: "internal", dataType: "boolean", columnType: "PgBoolean", primary: false },
    { key: "createdAt", dataType: "date", columnType: "PgTimestamp", primary: false },
  ],
};

describe("renderResourceFile", () => {
  it("writes a hidden event table with a reference, an enum stub and day and time formats", () => {
    expect(renderResourceFile(USER_VISIT, { hidden: true, schemaImport: "@/db/schema" })).toBe(
      [
        'import { enumOf, resource } from "@flowpanel/kit";',
        'import * as schema from "@/db/schema";',
        "",
        'const Surface = enumOf(schema.activitySurface.enumValues, { web: "Web", tma: "Tma" });',
        "",
        "export const userVisit = resource(schema.userVisit, {",
        "  hidden: true,",
        "  columns: [",
        '    "id",',
        '    { field: "userId", label: "User", reference: { resource: "user", labelField: "name" } },',
        '    { field: "surface", format: Surface.format },',
        '    { field: "startedAt", format: { kind: "date", time: true } },',
        '    { field: "day", format: { kind: "date", calendarDay: true } },',
        '    "firstPath",',
        '    "touches",',
        "  ],",
        '  filters: [{ field: "surface", type: "select" }],',
        '  defaultSort: { field: "startedAt", dir: "desc" },',
        "});",
        "",
      ].join("\n"),
    );
  });

  it("searches label-like text and sorts by createdAt", () => {
    expect(renderResourceFile(USER, { hidden: false, schemaImport: "../../db/schema" })).toBe(
      [
        'import { resource } from "@flowpanel/kit";',
        'import * as schema from "../../db/schema";',
        "",
        "export const user = resource(schema.user, {",
        "  columns: [",
        '    "id",',
        '    "name",',
        '    "email",',
        '    { field: "internal", format: "boolean" },',
        '    { field: "createdAt", format: { kind: "date", time: true } },',
        "  ],",
        '  search: ["name", "email"],',
        '  defaultSort: { field: "createdAt", dir: "desc" },',
        "});",
        "",
      ].join("\n"),
    );
  });

  it("leaves the form generated when no foreign key has a resource to pick from", () => {
    expect(renderResourceFile(USER, { hidden: false, schemaImport: "./schema" })).not.toContain(
      "create:",
    );
  });

  it("writes an inline enum when the schema exports no pgEnum for it", () => {
    const table: TableDescription = {
      exportName: "job",
      tableName: "job",
      columns: [
        {
          key: "state",
          dataType: "string",
          columnType: "SQLiteText",
          primary: false,
          enumValues: ["queued", "in-flight"],
        },
      ],
    };
    expect(renderResourceFile(table, { hidden: false, schemaImport: "./schema" })).toContain(
      'const State = enumOf({ queued: "Queued", "in-flight": "In flight" });',
    );
  });

  it("humanizes a snake_case enum value into a readable label", () => {
    const table: TableDescription = {
      exportName: "invoice",
      tableName: "invoice",
      columns: [
        {
          key: "status",
          dataType: "string",
          columnType: "PgText",
          primary: false,
          enumValues: ["paid", "past_due"],
        },
      ],
    };
    expect(renderResourceFile(table, { hidden: false, schemaImport: "./schema" })).toContain(
      'const Status = enumOf({ paid: "Paid", past_due: "Past due" });',
    );
  });

  it("wraps a long enum stub onto its own lines instead of one 80+ character line", () => {
    const table: TableDescription = {
      exportName: "listing",
      tableName: "listing",
      columns: [
        {
          key: "marketplace",
          dataType: "string",
          columnType: "PgText",
          primary: false,
          enumValues: ["ebay", "amazon", "etsy", "mercari", "poshmark", "facebook_marketplace"],
        },
      ],
    };
    const out = renderResourceFile(table, { hidden: false, schemaImport: "./schema" });
    expect(out).toContain("const Marketplace = enumOf({\n  ebay:");
    expect(out).toContain('facebook_marketplace: "Facebook marketplace",\n});');
    for (const line of out.split("\n")) expect(line.length).toBeLessThanOrEqual(100);
  });
});

describe("columnKind", () => {
  it("leaves out a UUID or cuid primary key, which only widens the list", () => {
    for (const columnType of ["PgUUID", "PrismaUuid", "PrismaCuid"]) {
      expect(columnKind({ key: "id", dataType: "string", columnType, primary: true })).toBe("skip");
    }
    expect(
      columnKind({ key: "id", dataType: "number", columnType: "PgSerial", primary: true }),
    ).toBe("plain");
    expect(
      columnKind({ key: "ref", dataType: "string", columnType: "PgUUID", primary: false }),
    ).toBe("plain");
  });

  it("leaves out JSON, long varchar and long-text columns", () => {
    const base = { primary: false, dataType: "string" };
    expect(columnKind({ ...base, key: "meta", dataType: "json", columnType: "PgJsonb" })).toBe(
      "skip",
    );
    expect(columnKind({ ...base, key: "bio", columnType: "PgVarchar", length: 500 })).toBe("skip");
    expect(columnKind({ ...base, key: "prompt", columnType: "PgText" })).toBe("skip");
    expect(columnKind({ ...base, key: "title", columnType: "PgText" })).toBe("plain");
  });

  it("tells a day from a timestamp in every dialect", () => {
    const base = { key: "at", primary: false, dataType: "date" };
    expect(columnKind({ ...base, columnType: "PgTimestamp" })).toBe("timestamp");
    expect(columnKind({ ...base, columnType: "SQLiteTimestamp" })).toBe("timestamp");
    expect(columnKind({ ...base, columnType: "MySqlDateTime" })).toBe("timestamp");
    expect(columnKind({ ...base, columnType: "PgDate" })).toBe("date");
    expect(columnKind({ ...base, columnType: "PrismaDate" })).toBe("date");
    expect(columnKind({ ...base, dataType: "string", columnType: "PgDateString" })).toBe("date");
  });
});

describe("money columns", () => {
  const column = (key: string, columnType: string, dataType = "number") => ({
    key,
    dataType,
    columnType,
    primary: false,
  });

  it("formats an integer column named in cents as money, in every dialect and in Prisma", () => {
    for (const [key, type, data] of [
      ["amountCents", "PgInteger", "number"],
      ["mrr_cents", "PgBigInt53", "number"],
      ["totalCents", "PgBigInt64", "bigint"],
      ["feeCents", "SQLiteInteger", "number"],
      ["priceCents", "MySqlInt", "number"],
      ["amountCents", "PrismaInt", "number"],
    ] as const) {
      expect(columnKind(column(key, type, data)), `${key} ${type}`).toBe("money");
    }
    const out = renderResourceFile(
      {
        exportName: "invoice",
        tableName: "invoice",
        columns: [column("amountCents", "PgInteger")],
      },
      { hidden: false, schemaImport: "@/db/schema" },
    );
    expect(out).toContain('{ field: "amountCents", format: { kind: "money", minorUnits: 2 } },');
  });

  it("leaves a decimal, a text or an unrelated integer as it is", () => {
    expect(columnKind(column("amountCents", "PgNumeric"))).toBe("plain");
    expect(columnKind(column("amountCents", "PgText", "string"))).toBe("plain");
    expect(columnKind(column("percents", "PgInteger"))).toBe("plain");
  });
});

describe("fileBaseOf", () => {
  it("kebab-cases the schema export", () => {
    expect(fileBaseOf("userVisit")).toBe("user-visit");
    expect(fileBaseOf("onboardingStepEvent")).toBe("onboarding-step-event");
    expect(fileBaseOf("user")).toBe("user");
  });
});
