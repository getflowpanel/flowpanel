import type { ColumnDescription, TableDescription } from "./describe-schema";

export type ColumnKind = "skip" | "timestamp" | "date" | "boolean" | "enum" | "plain";

const SEARCH_KEYS = ["name", "title", "email"];
const SORT_KEYS = ["createdAt", "startedAt", "at", "updatedAt"];
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
  return "plain";
}

/** `userVisit` → `user-visit`, the file a resource is written to. */
export function fileBaseOf(exportName: string): string {
  return exportName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const pascal = (key: string): string => `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
const property = (value: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(value) ? value : JSON.stringify(value);

/** `past_due` → `Past due`, a readable stand-in label until the user picks their own. */
function humanizeEnumValue(value: string): string {
  const [head, ...rest] = value.replace(/[_-]+/g, " ").trim().split(/\s+/);
  if (!head) return value;
  return [
    `${head.charAt(0).toUpperCase()}${head.slice(1).toLowerCase()}`,
    ...rest.map((w) => w.toLowerCase()),
  ].join(" ");
}

function entries(values: readonly string[]): string {
  const rendered = values.map(
    (value) => `${property(value)}: ${JSON.stringify(humanizeEnumValue(value))}`,
  );
  const oneLine = `{ ${rendered.join(", ")} }`;
  if (oneLine.length <= 80) return oneLine;
  return `{\n  ${rendered.join(",\n  ")},\n}`;
}

/** `userId` → `User`: a foreign key's header names the record, not its key. */
function referenceLabel(key: string): string | null {
  const base = key.replace(/(?:_id|Id|ID)$/, "");
  if (base === key || base === "") return null;
  return humanizeEnumValue(base.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
}

function columnSource(column: ColumnDescription, kind: ColumnKind, enumConsts: boolean): string {
  const field = JSON.stringify(column.key);
  if (column.references) {
    const { table, labelField } = column.references;
    const label = referenceLabel(column.key);
    return `{ field: ${field}, ${label ? `label: ${JSON.stringify(label)}, ` : ""}reference: { resource: ${JSON.stringify(table)}, labelField: ${JSON.stringify(labelField)} } }`;
  }
  if (kind === "timestamp") return `{ field: ${field}, format: { kind: "date", time: true } }`;
  if (kind === "date") return `{ field: ${field}, format: { kind: "date", calendarDay: true } }`;
  if (kind === "boolean") return `{ field: ${field}, format: "boolean" }`;
  if (kind === "enum" && enumConsts) {
    return `{ field: ${field}, format: ${pascal(column.key)}.format }`;
  }
  return field;
}

function fieldSource(
  column: ColumnDescription,
  kind: ColumnKind,
  enumOptions: string | null,
): string | null {
  if (column.primary || column.dataType === "buffer") return null;
  const name = `name: ${JSON.stringify(column.key)}`;
  if (column.references) {
    const { table, labelField } = column.references;
    const label = referenceLabel(column.key);
    return `{ ${name}, ${label ? `label: ${JSON.stringify(label)}, ` : ""}reference: { resource: ${JSON.stringify(table)}, labelField: ${JSON.stringify(labelField)} } }`;
  }
  if (column.enumValues) {
    const values = `[${column.enumValues.map((value) => JSON.stringify(value)).join(", ")}]`;
    return `{ ${name}, type: "select", options: ${enumOptions ?? values} }`;
  }
  if (kind === "timestamp") return `{ ${name}, type: "datetime" }`;
  if (kind === "date") return `{ ${name}, type: "date" }`;
  if (column.dataType === "boolean") return `{ ${name}, type: "checkbox" }`;
  if (column.dataType === "number") return `{ ${name}, type: "number" }`;
  if (column.dataType === "json") return `{ ${name}, type: "json" }`;
  if (/Text$/.test(column.columnType) && LONG_TEXT.test(column.key)) {
    return `{ ${name}, type: "textarea" }`;
  }
  return `{ ${name} }`;
}

/** The create and edit form, written only when a foreign key can become a picker. */
function formLines(table: TableDescription, enumConsts: ReadonlySet<string>): string[] {
  if (!table.columns.some((column) => column.references)) return [];
  const fields = table.columns.flatMap((column) => {
    const source = fieldSource(
      column,
      columnKind(column),
      enumConsts.has(column.key) ? `${pascal(column.key)}.options` : null,
    );
    return source === null ? [] : [`      ${source},`];
  });
  return ["  create: {", "    fields: [", ...fields, "    ],", "  },"];
}

export interface RenderOptions {
  hidden: boolean;
  /** The specifier the resource file imports `* as schema` from. */
  schemaImport: string;
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
  table: TableDescription,
  { kept, enums }: Planned,
  options: { hidden: boolean; enumConsts: boolean; name?: string },
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
  const consts = new Set(options.enumConsts ? enums.map(({ column }) => column.key) : []);
  lines.push(...formLines(table, consts));
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
    ...optionLines(table, plan(table), { ...options, enumConsts: false }),
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
  lines.push(...optionLines(table, planned, { hidden: options.hidden, enumConsts: true }));
  lines.push("});", "");
  return lines.join("\n");
}
