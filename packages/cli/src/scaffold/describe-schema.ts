import * as fs from "node:fs/promises";
import { readTsconfigAliases } from "../utils/tsconfig";

interface JitiInstance {
  import: (id: string) => Promise<unknown>;
}

interface JitiModule {
  createJiti: (
    id: string,
    opts?: { interopDefault?: boolean; jsx?: boolean; alias?: Record<string, string> },
  ) => JitiInstance;
}

interface DrizzleColumn {
  name: string;
  dataType: string;
  columnType: string;
  primary: boolean;
  notNull: boolean;
  hasDefault: boolean;
  enumValues?: readonly string[];
  enum?: unknown;
  length?: number;
}

interface DrizzleOrm {
  is(value: unknown, type: unknown): boolean;
  Table: unknown;
  getTableName(table: unknown): string;
  getTableColumns(table: unknown): Record<string, DrizzleColumn>;
}

interface ForeignKeyReference {
  columns: DrizzleColumn[];
  foreignColumns: DrizzleColumn[];
  foreignTable: unknown;
}

interface DialectModule {
  getTableConfig(table: unknown): { foreignKeys: Array<{ reference(): ForeignKeyReference }> };
}

export interface ColumnDescription {
  /** The property name on the table object, which rows and resource options use. */
  key: string;
  dataType: string;
  columnType: string;
  primary: boolean;
  notNull?: boolean;
  /** A database or `$defaultFn` default, so an insert may leave the column out. */
  hasDefault?: boolean;
  length?: number;
  enumValues?: readonly string[];
  /** The schema export that holds the column's `pgEnum`. */
  enumExport?: string;
  /** Where the column points, from the table's own foreign keys. */
  references?: { table: string; labelField: string };
}

export interface TableDescription {
  exportName: string;
  tableName: string;
  columns: ColumnDescription[];
}

export const LABEL_KEYS = ["name", "title", "email"];
const DIALECTS: ReadonlyArray<[prefix: string, module: string]> = [
  ["Pg", "drizzle-orm/pg-core"],
  ["SQLite", "drizzle-orm/sqlite-core"],
  ["MySql", "drizzle-orm/mysql-core"],
];

function keyOf(
  columns: Record<string, DrizzleColumn>,
  column: DrizzleColumn | undefined,
): string | undefined {
  return Object.entries(columns).find(([, candidate]) => candidate.name === column?.name)?.[0];
}

function declarationOrder(source: string, exportName: string): number {
  const at = new RegExp(`export\\s+const\\s+${exportName.replaceAll("$", "\\$")}(?![\\w$])`).exec(
    source,
  )?.index;
  return at ?? Number.POSITIVE_INFINITY;
}

/** The text column a reference shows: a NOT NULL name, title or email first, so no row reads as its raw key. */
export function labelField(
  columns: ReadonlyArray<Pick<ColumnDescription, "key" | "dataType" | "notNull">>,
  fallback: string,
): string {
  const text = LABEL_KEYS.map((key) => columns.find((c) => c.key === key)).filter(
    (column) => column?.dataType === "string",
  );
  return (text.find((column) => column?.notNull) ?? text[0])?.key ?? fallback;
}

async function referencesOf(
  jiti: JitiInstance,
  orm: DrizzleOrm,
  table: unknown,
  columns: Record<string, DrizzleColumn>,
): Promise<Map<string, { table: string; labelField: string }>> {
  const found = new Map<string, { table: string; labelField: string }>();
  const first = Object.values(columns)[0];
  const dialect = DIALECTS.find(([prefix]) => first?.columnType.startsWith(prefix))?.[1];
  if (!dialect) return found;
  const { getTableConfig } = (await jiti.import(dialect)) as DialectModule;
  for (const foreignKey of getTableConfig(table).foreignKeys) {
    const reference = foreignKey.reference();
    const index =
      reference.foreignColumns.length === 1
        ? 0
        : reference.foreignColumns.findIndex((column) => column.primary);
    const key = index < 0 ? undefined : keyOf(columns, reference.columns[index]);
    if (!key) continue;
    const target = orm.getTableColumns(reference.foreignTable);
    const targetKey = keyOf(target, reference.foreignColumns[index]) ?? "id";
    found.set(key, {
      table: orm.getTableName(reference.foreignTable),
      labelField: labelField(
        Object.entries(target).map(([key, column]) => ({ key, ...column })),
        targetKey,
      ),
    });
  }
  return found;
}

/** Every table the host's Drizzle schema exports, read through the host's own drizzle-orm. */
export async function describeSchema(cwd: string, schemaFile: string): Promise<TableDescription[]> {
  const { createJiti } = (await import("jiti")) as JitiModule;
  const jiti = createJiti(schemaFile, {
    interopDefault: true,
    jsx: true,
    alias: await readTsconfigAliases(cwd),
  });
  const schema = (await jiti.import(schemaFile)) as Record<string, unknown>;
  const orm = (await jiti.import("drizzle-orm")) as DrizzleOrm;
  const exportOf = (value: unknown) =>
    Object.entries(schema).find(([, candidate]) => candidate === value)?.[0];
  const tables: TableDescription[] = [];
  for (const [exportName, value] of Object.entries(schema)) {
    if (!orm.is(value, orm.Table)) continue;
    const columns = orm.getTableColumns(value);
    const references = await referencesOf(jiti, orm, value, columns);
    tables.push({
      exportName,
      tableName: orm.getTableName(value),
      columns: Object.entries(columns).map(([key, column]) => {
        const enumExport = column.enum === undefined ? undefined : exportOf(column.enum);
        const reference = references.get(key);
        return {
          key,
          dataType: column.dataType,
          columnType: column.columnType,
          primary: column.primary,
          notNull: column.notNull,
          hasDefault: column.hasDefault,
          ...(column.length === undefined ? {} : { length: column.length }),
          ...(column.enumValues && column.enumValues.length > 0
            ? { enumValues: column.enumValues }
            : {}),
          ...(enumExport === undefined ? {} : { enumExport }),
          ...(reference ? { references: reference } : {}),
        };
      }),
    });
  }
  const source = await fs.readFile(schemaFile, "utf8");
  return tables.sort(
    (a, b) => declarationOrder(source, a.exportName) - declarationOrder(source, b.exportName),
  );
}
