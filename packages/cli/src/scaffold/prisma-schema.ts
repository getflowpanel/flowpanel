import * as fs from "node:fs/promises";
import { findPrismaSchemaFiles } from "../utils/prisma-provider";
import { type ColumnDescription, labelField, type TableDescription } from "./describe-schema";

const BLOCK = /^\s*(model|enum)\s+(\w+)\s*\{([^}]*)\}/gm;
const FIELD = /^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/;
const RELATION = /@relation\([^)]*\bfields:\s*\[\s*(\w+)\s*\][^)]*\breferences:\s*\[\s*(\w+)\s*\]/;
const SCALARS: Record<string, string> = {
  String: "string",
  Int: "number",
  BigInt: "bigint",
  Float: "number",
  Decimal: "number",
  Boolean: "boolean",
  DateTime: "date",
  Json: "json",
  Bytes: "buffer",
};

function columnType(type: string, attributes: string): string {
  if (type === "DateTime") return /@db\.Date\b/.test(attributes) ? "PrismaDate" : "PrismaDateTime";
  if (type === "String" && /@db\.(?:Text|MediumText|LongText)\b/.test(attributes)) {
    return "PrismaText";
  }
  if (type === "String" && /@db\.Uuid\b|@default\(\s*uuid\(/.test(attributes)) return "PrismaUuid";
  if (type === "String" && /@default\(\s*(?:cuid|ulid|nanoid)\(/.test(attributes)) {
    return "PrismaCuid";
  }
  return `Prisma${type}`;
}

function columnOf(line: string, enums: ReadonlyMap<string, string[]>): ColumnDescription | null {
  const match = FIELD.exec(line.trim());
  if (!match) return null;
  const [, key = "", type = "", list, optional, attributes = ""] = match;
  if (list) return null;
  const enumValues = enums.get(type);
  const dataType = SCALARS[type] ?? (enumValues ? "string" : null);
  if (dataType === null) return null;
  return {
    key,
    dataType,
    columnType: columnType(type, attributes),
    primary: /@id\b/.test(attributes),
    notNull: !optional,
    ...(enumValues ? { enumValues } : {}),
  };
}

/** Foreign key field → the model it points at and the field it matches, from each `@relation(fields, references)`. */
function relationsOf(body: string): Map<string, { model: string; key: string }> {
  const found = new Map<string, { model: string; key: string }>();
  for (const line of body.split("\n")) {
    const field = FIELD.exec(line.trim());
    const relation = RELATION.exec(line);
    if (!field || !relation || field[3]) continue;
    found.set(relation[1] ?? "", { model: field[2] ?? "", key: relation[2] ?? "" });
  }
  return found;
}

/** Every model of the project's Prisma schema: scalar fields as columns, `@@map` as the table name. */
export async function describePrismaSchema(cwd: string): Promise<TableDescription[]> {
  const sources = await Promise.all(
    (await findPrismaSchemaFiles(cwd)).map((file) => fs.readFile(file, "utf8")),
  );
  const source = sources.join("\n").replace(/\/\/[^\n]*/g, "");
  const blocks = [...source.matchAll(BLOCK)];
  const enums = new Map(
    blocks
      .filter((block) => block[1] === "enum")
      .map((block) => [
        block[2] ?? "",
        (block[3] ?? "")
          .split("\n")
          .map((line) => line.trim().split(/\s+/)[0] ?? "")
          .filter((value) => /^\w+$/.test(value)),
      ]),
  );
  const models = blocks
    .filter((block) => block[1] === "model")
    .map((block) => {
      const body = block[3] ?? "";
      const name = block[2] ?? "";
      return {
        exportName: name,
        tableName: /@@map\(\s*"([^"]+)"\s*\)/.exec(body)?.[1] ?? name,
        relations: relationsOf(body),
        columns: body
          .split("\n")
          .filter((line) => !line.trim().startsWith("@@"))
          .map((line) => columnOf(line, enums))
          .filter((column): column is ColumnDescription => column !== null),
      };
    });
  return models.map(({ relations, ...model }) => ({
    ...model,
    columns: model.columns.map((column) => {
      const relation = relations.get(column.key);
      const target = relation && models.find((m) => m.exportName === relation.model);
      if (!relation || !target) return column;
      const shown = labelField(target.columns, relation.key);
      return { ...column, references: { table: target.exportName, labelField: shown } };
    }),
  }));
}

/** The model `name` means: the model itself, the one mapped to that table, or a case-insensitive match. */
export function findPrismaModel(
  models: readonly TableDescription[],
  name: string,
): TableDescription | null {
  return (
    models.find((model) => model.exportName === name) ??
    models.find((model) => model.tableName === name) ??
    models.find((model) => model.exportName.toLowerCase() === name.toLowerCase()) ??
    null
  );
}

function plural(word: string): string {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:ss|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (word.endsWith("s")) return word;
  return `${word}s`;
}

/**
 * The resource name `new` gives a model, so its URL and navigation read like a Drizzle table's:
 * the `@@map` table name, else the model in plural snake case (`OrderItem` → `order_items`).
 */
export function prismaResourceName(model: TableDescription): string {
  if (model.tableName !== model.exportName) return model.tableName;
  return plural(model.exportName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase());
}
