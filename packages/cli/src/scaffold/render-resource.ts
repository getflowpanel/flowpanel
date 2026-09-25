import type { ColumnDescription, TableDescription } from "./describe-schema";

export type ColumnKind = "skip" | "timestamp" | "date" | "boolean" | "enum" | "plain";

const SEARCH_KEYS = ["name", "title", "email"];
const SORT_KEYS = ["createdAt", "startedAt", "at", "updatedAt"];
const LONG_TEXT =
  /(?:description|body|content|text|notes?|html|markdown|prompt|payload|bio|summary|message)$/i;

/** How a column appears in a scaffolded list: left out, formatted, or as is. */
export function columnKind(column: ColumnDescription): ColumnKind {
  if (column.dataType === "json") return "skip";
  if (column.length !== undefined && column.length > 200) return "skip";
  if (/Text$/.test(column.columnType) && LONG_TEXT.test(column.key)) return "skip";
  if (/Timestamp|DateTime/.test(column.columnType)) return "timestamp";
  if (/Date(String)?$/.test(column.columnType)) return "date";
  if (column.enumValues) return "enum";
  if (column.dataType === "boolean") return "boolean";
  return "plain";
}

/** `userVisit` → `user-visit`, the file a resource is written to. */
export function fileBaseOf(exportName: string): string {
  return exportName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const pascal = (key: string): string => `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
const property = (value: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);
const entries = (values: readonly string[]): string =>
  `{ ${values.map((value) => `${property(value)}: ${JSON.stringify(value)}`).join(", ")} }`;

function columnSource(column: ColumnDescription, kind: ColumnKind): string {
  const field = JSON.stringify(column.key);
  if (column.references) {
    const { table, labelField } = column.references;
    return `{ field: ${field}, reference: { resource: ${JSON.stringify(table)}, labelField: ${JSON.stringify(labelField)} } }`;
  }
  if (kind === "timestamp") return `{ field: ${field}, format: { kind: "date", time: true } }`;
  if (kind === "date") return `{ field: ${field}, format: "date" }`;
  if (kind === "boolean") return `{ field: ${field}, format: "boolean" }`;
  if (kind === "enum") return `{ field: ${field}, format: ${pascal(column.key)}.format }`;
  return field;
}

export interface RenderOptions {
  hidden: boolean;
  /** The specifier the resource file imports `* as schema` from. */
  schemaImport: string;
}

/** The source of one resource file: `resource(schema.<export>, { columns, search, filters, defaultSort })`. */
export function renderResourceFile(table: TableDescription, options: RenderOptions): string {
  const kept = table.columns
    .map((column) => ({ column, kind: columnKind(column) }))
    .filter(({ kind }) => kind !== "skip");
  const enums = kept.filter(({ column, kind }) => kind === "enum" && !column.references);
  const search = kept
    .filter(({ column }) => SEARCH_KEYS.includes(column.key) && column.dataType === "string")
    .map(({ column }) => JSON.stringify(column.key));
  const dated = kept.filter(({ kind }) => kind === "timestamp" || kind === "date");
  const sort =
    SORT_KEYS.map((key) => dated.find(({ column }) => column.key === key)).find(Boolean) ??
    kept.find(({ kind }) => kind === "timestamp");

  const lines = [
    `import { ${enums.length > 0 ? "enumOf, " : ""}resource } from "@flowpanel/kit";`,
    `import * as schema from ${JSON.stringify(options.schemaImport)};`,
    "",
  ];
  for (const { column } of enums) {
    const values = entries(column.enumValues ?? []);
    const call = column.enumExport
      ? `enumOf(schema.${column.enumExport}.enumValues, ${values})`
      : `enumOf(${values})`;
    lines.push(`const ${pascal(column.key)} = ${call};`);
  }
  if (enums.length > 0) lines.push("");
  lines.push(`export const ${table.exportName} = resource(schema.${table.exportName}, {`);
  if (options.hidden) lines.push("  hidden: true,");
  lines.push("  columns: [");
  for (const { column, kind } of kept) lines.push(`    ${columnSource(column, kind)},`);
  lines.push("  ],");
  if (search.length > 0) lines.push(`  search: [${search.join(", ")}],`);
  if (enums.length > 0) {
    const filters = enums.map(
      ({ column }) => `{ field: ${JSON.stringify(column.key)}, type: "select" }`,
    );
    lines.push(`  filters: [${filters.join(", ")}],`);
  }
  if (sort)
    lines.push(`  defaultSort: { field: ${JSON.stringify(sort.column.key)}, dir: "desc" },`);
  lines.push("});", "");
  return lines.join("\n");
}
