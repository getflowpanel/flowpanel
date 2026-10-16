import { humanize, humanizeReference } from "@flowpanel/core/labels";
import type { ColumnDescription, TableDescription } from "./describe-schema";

export type ColumnKind = "skip" | "timestamp" | "date" | "boolean" | "enum" | "money" | "plain";

const SEARCH_KEYS = ["name", "title", "email"];
const SORT_KEYS = ["createdAt", "startedAt", "at", "updatedAt"];
const CENTS = /(?:Cents|_cents)$/;
const INTEGER = /Int(?:eger)?(?:53|64)?$/;
const LONG_TEXT =
  /(?:description|body|content|text|notes?|html|markdown|prompt|payload|bio|summary|message)$/i;

/** How a column appears in a scaffolded list: left out, formatted, or as is. */
export function columnKind(column: ColumnDescription): ColumnKind {
  if (column.primary && /(?:UUID|Uuid|Cuid)$/.test(column.columnType)) return "skip";
  if (column.dataType === "json" || column.dataType === "buffer") return "skip";
  if (column.length !== undefined && column.length > 200) return "skip";
  if (/Text$/.test(column.columnType) && LONG_TEXT.test(column.key)) return "skip";
  if (/Timestamp|DateTime/.test(column.columnType)) return "timestamp";
  if (/Date(String)?$/.test(column.columnType)) return "date";
  if (column.enumValues) return "enum";
  if (column.dataType === "boolean") return "boolean";
  if (CENTS.test(column.key) && INTEGER.test(column.columnType)) return "money";
  return "plain";
}

/** `userVisit` → `user-visit`, the file a resource is written to. */
export function fileBaseOf(exportName: string): string {
  return exportName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const pascal = (key: string): string => `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
const property = (value: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);

function entries(values: readonly string[]): string {
  const rendered = values.map((value) => `${property(value)}: ${JSON.stringify(humanize(value))}`);
  const oneLine = `{ ${rendered.join(", ")} }`;
  if (oneLine.length <= 80) return oneLine;
  return `{\n  ${rendered.join(",\n  ")},\n}`;
}

function columnSource(column: ColumnDescription, kind: ColumnKind, enumConsts: boolean): string {
  const field = JSON.stringify(column.key);
  if (column.references) {
    const { table, labelField } = column.references;
    const label = humanizeReference(column.key);
    return `{ field: ${field}, label: ${JSON.stringify(label)}, reference: { resource: ${JSON.stringify(table)}, labelField: ${JSON.stringify(labelField)} } }`;
  }
  if (kind === "timestamp") return `{ field: ${field}, format: { kind: "date", time: true } }`;
  if (kind === "date") return `{ field: ${field}, format: { kind: "date", calendarDay: true } }`;
  if (kind === "boolean") return `{ field: ${field}, format: "boolean" }`;
  if (kind === "money") return `{ field: ${field}, format: { kind: "money", minorUnits: 2 } }`;
  if (kind === "enum" && enumConsts) {
    return `{ field: ${field}, format: ${pascal(column.key)}.format }`;
  }
  return field;
}

export interface RenderOptions {
  hidden: boolean;
  /** The specifier the resource file imports `* as schema` from. */
  schemaImport: string;
}

const UNCOUNTED = new Set([
  "analytics",
  "audit",
  "billing",
  "data",
  "feedback",
  "history",
  "info",
  "inventory",
  "media",
  "metadata",
  "news",
  "series",
  "settings",
  "species",
  "staff",
  "usage",
]);

/** `user` → `Users`: a singular table's plural navigation label, which `humanize` would leave singular. */
export function scaffoldPlural(tableName: string): string | null {
  const words = tableName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .filter(Boolean);
  const last = words.pop()?.toLowerCase();
  if (!last || last.endsWith("s") || UNCOUNTED.has(last)) return null;
  const plural = /[^aeiou]y$/.test(last)
    ? `${last.slice(0, -1)}ies`
    : /(?:x|z|ch|sh)$/.test(last)
      ? `${last}es`
      : `${last}s`;
  return humanize([...words, plural].join(" "));
}

interface Planned {
  kept: Array<{ column: ColumnDescription; kind: ColumnKind }>;
  enums: Array<{ column: ColumnDescription; kind: ColumnKind }>;
}

function plan(table: TableDescription): Planned {
  const kept = table.columns
    .map((column) => ({ column, kind: columnKind(column) }))
    .filter(({ kind }) => kind !== "skip");
  return { kept, enums: kept.filter(({ column, kind }) => kind === "enum" && !column.references) };
}

/** The option lines of a scaffolded `resource(...)` call, indented two spaces. */
function optionLines(
  { kept, enums }: Planned,
  options: { hidden: boolean; enumConsts: boolean; name?: string; plural?: string | null },
): string[] {
  const search = kept
    .filter(({ column }) => SEARCH_KEYS.includes(column.key) && column.dataType === "string")
    .map(({ column }) => JSON.stringify(column.key));
  const dated = kept.filter(({ kind }) => kind === "timestamp" || kind === "date");
  const sort =
    SORT_KEYS.map((key) => dated.find(({ column }) => column.key === key)).find(Boolean) ??
    kept.find(({ kind }) => kind === "timestamp");
  const lines: string[] = [];
  if (options.name !== undefined) lines.push(`  name: ${JSON.stringify(options.name)},`);
  if (options.plural) lines.push(`  plural: ${JSON.stringify(options.plural)},`);
  if (options.hidden) lines.push("  hidden: true,");
  lines.push("  columns: [");
  for (const { column, kind } of kept) {
    lines.push(`    ${columnSource(column, kind, options.enumConsts)},`);
  }
  lines.push("  ],");
  if (search.length > 0) lines.push(`  search: [${search.join(", ")}],`);
  if (enums.length > 0) {
    const filters = enums.map(
      ({ column }) => `{ field: ${JSON.stringify(column.key)}, type: "select" }`,
    );
    lines.push(`  filters: [${filters.join(", ")}],`);
  }
  if (sort) {
    lines.push(`  defaultSort: { field: ${JSON.stringify(sort.column.key)}, dir: "desc" },`);
  }
  return lines;
}

/** `resource(<ref>, { columns, search, filters, defaultSort })` for a config's `resources` array. */
export function renderResourceEntry(
  table: TableDescription,
  ref: string,
  options: { hidden: boolean; name?: string },
): string {
  return [
    `resource(${ref}, {`,
    ...optionLines(plan(table), {
      ...options,
      enumConsts: false,
      plural: scaffoldPlural(options.name ?? table.tableName),
    }),
    "})",
  ].join("\n");
}

/** The source of one resource file: `resource(schema.<export>, { columns, search, filters, defaultSort })`. */
export function renderResourceFile(table: TableDescription, options: RenderOptions): string {
  const planned = plan(table);
  const lines = [
    `import { ${planned.enums.length > 0 ? "enumOf, " : ""}resource } from "@flowpanel/kit";`,
    `import * as schema from ${JSON.stringify(options.schemaImport)};`,
    "",
  ];
  for (const { column } of planned.enums) {
    const values = entries(column.enumValues ?? []);
    const call = column.enumExport
      ? `enumOf(schema.${column.enumExport}.enumValues, ${values})`
      : `enumOf(${values})`;
    lines.push(`const ${pascal(column.key)} = ${call};`);
  }
  if (planned.enums.length > 0) lines.push("");
  lines.push(`export const ${table.exportName} = resource(schema.${table.exportName}, {`);
  lines.push(
    ...optionLines(planned, {
      hidden: options.hidden,
      enumConsts: true,
      plural: scaffoldPlural(table.tableName),
    }),
  );
  lines.push("});", "");
  return lines.join("\n");
}
