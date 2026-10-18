import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileIntent } from "../plan/types";
import { noConfigMessage } from "../utils/config-problem";
import { detectPackageManager, pmCommands } from "../utils/detect";
import { resolveProjectModule } from "../utils/module-path";
import { findAdminConfig } from "./config-target";
import { describeSchema, type TableDescription } from "./describe-schema";
import { appendToIndex } from "./index-file";
import { linkPrismaReferences } from "./prisma-references";
import { describePrismaSchema, findPrismaModel, prismaResourceName } from "./prisma-schema";
import { fileBaseOf, renderResourceEntry, renderResourceFile } from "./render-resource";

const SCHEMA_IMPORT = /import\s+\*\s+as\s+schema\s+from\s+["']([^"']+)["']/;

export interface NewIntoDirOptions {
  /** Directory with one file per resource and an `index.ts` — relative to `cwd`, or absolute. */
  dir: string;
  /** Register the resource with no navigation entry. */
  hidden: boolean;
}

export interface NewIntoDirPlan {
  intents: FileIntent[];
  /** `"<column> → <table>"` for each foreign key written plain, because its target has no resource yet. */
  unlinked: string[];
}

const RESOURCE_CALL = /resource\(\s*(?:schema\.)?(\w+)\s*,/g;
const OWN_NAME = /^ {2}name:\s*"([^"]+)"/m;

/** Table name → the name its resource is registered under, for every table `directory` registers. */
async function registeredTables(
  directory: string,
  tables: readonly TableDescription[],
): Promise<Map<string, string>> {
  const files = await fs.readdir(directory).catch(() => [] as string[]);
  const named = new Map<string, string | undefined>();
  for (const file of files.filter((name) => /\.tsx?$/.test(name))) {
    const source = await fs.readFile(path.join(directory, file), "utf8");
    const calls = [...source.matchAll(RESOURCE_CALL)].map((match) => match[1] as string);
    const own = calls.length === 1 ? OWN_NAME.exec(source)?.[1] : undefined;
    for (const exportName of calls) named.set(exportName, own);
  }
  return new Map(
    tables
      .filter((t) => named.has(t.exportName))
      .map((t) => [t.tableName, named.get(t.exportName) ?? t.tableName]),
  );
}

function linkable(table: TableDescription, registered: ReadonlyMap<string, string>) {
  const unlinked: string[] = [];
  const columns = table.columns.map((column) => {
    const references = column.references;
    if (references === undefined || references.table === table.tableName) return column;
    const resource = registered.get(references.table);
    if (resource !== undefined)
      return { ...column, references: { ...references, table: resource } };
    unlinked.push(`${column.key} → ${references.table}`);
    const { references: _references, ...plain } = column;
    return plain;
  });
  return { table: { ...table, columns }, unlinked };
}

async function readOrNull(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function schemaSpecifier(absoluteDir: string, spec: string, schemaFile: string): string {
  if (!spec.startsWith(".")) return spec;
  const relative = path
    .relative(absoluteDir, schemaFile)
    .replace(/\.[cm]?[jt]sx?$/, "")
    .replace(/[\\/]index$/, "")
    .split(path.sep)
    .join("/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** What `flowpanel new <table> --dir <dir>` writes: the resource file and its index entry. */
export async function planNewIntoDir(
  cwd: string,
  name: string,
  options: NewIntoDirOptions,
): Promise<NewIntoDirPlan> {
  const config = await findAdminConfig(cwd);
  if (!config) {
    throw new Error(noConfigMessage(cwd, pmCommands(await detectPackageManager(cwd)).dlx));
  }
  const configName = path.relative(cwd, config.file);
  const spec = SCHEMA_IMPORT.exec(await fs.readFile(config.file, "utf8"))?.[1];
  if (!spec) {
    throw new Error(
      `${configName} has no \`import * as schema from "…"\` line, so --dir cannot find the table.`,
    );
  }
  const schemaFile = await resolveProjectModule(cwd, spec, config.file);
  if (!schemaFile) throw new Error(`"${spec}" does not resolve to a file from ${configName}.`);
  const tables = await describeSchema(cwd, schemaFile);
  const table = tables.find((t) => t.tableName === name || t.exportName === name);
  if (!table) {
    const known = tables.map((t) => t.tableName).sort();
    throw new Error(
      `${path.relative(cwd, schemaFile)} has no table "${name}". Tables: ${known.join(", ")}`,
    );
  }
  const fileBase = fileBaseOf(table.exportName);
  const absoluteDir = path.resolve(cwd, options.dir);
  const relativeDir = path.relative(cwd, absoluteDir);
  const indexPath = path.join(relativeDir, "index.ts");
  const index = await readOrNull(path.join(absoluteDir, "index.ts"));
  const registered = await registeredTables(absoluteDir, tables);
  const { table: written, unlinked } = linkable(table, registered);
  const content = renderResourceFile(written, {
    hidden: options.hidden,
    schemaImport: schemaSpecifier(absoluteDir, spec, schemaFile),
  });
  return {
    unlinked,
    intents: [
      { path: path.join(relativeDir, `${fileBase}.ts`), content },
      {
        path: indexPath,
        content: appendToIndex(index, table.exportName, fileBase),
        ...(index === null ? {} : { expectedContent: index }),
      },
    ],
  };
}

const PRISMA_CALL = /resource\(\s*["'](\w+)["']\s*,\s*(?:\{\s*name:\s*["']([^"']+)["'])?/g;

/** `order_items` → `orderItems`, the variable a Prisma resource file exports. */
export function exportNameOf(resourceName: string): string {
  const camel = resourceName.replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c: string) => c.toUpperCase());
  const safe = camel.replace(/[^\w$]/g, "");
  return /^[A-Za-z_$]/.test(safe) ? safe : `_${safe}`;
}

/** Model → resource name for every Prisma resource the directory's files register. */
async function registeredModels(directory: string): Promise<Map<string, string>> {
  const files = await fs.readdir(directory).catch(() => [] as string[]);
  const out = new Map<string, string>();
  for (const file of files.filter((name) => /\.tsx?$/.test(name))) {
    const source = await fs.readFile(path.join(directory, file), "utf8");
    for (const match of source.matchAll(PRISMA_CALL)) {
      const model = match[1] ?? "";
      out.set(model, match[2] ?? model);
    }
  }
  return out;
}

interface PrismaIntoDirOptions extends NewIntoDirOptions {
  /** The model, as `describePrismaSchema` reads it. */
  model: TableDescription;
  /** The name the resource registers under, such as `orders` for `Order`. */
  name: string;
  /** Models the config itself already registers, by resource name. */
  registered: ReadonlyMap<string, string>;
}

/** What `flowpanel new <model> --dir <dir>` writes on Prisma: the resource file and its index entry. */
async function planPrismaIntoDir(
  cwd: string,
  options: PrismaIntoDirOptions,
): Promise<NewIntoDirPlan> {
  const { model, name } = options;
  const absoluteDir = path.resolve(cwd, options.dir);
  const relativeDir = path.relative(cwd, absoluteDir);
  const registered = new Map([...options.registered, ...(await registeredModels(absoluteDir))]);
  const linked = linkPrismaReferences(model, name, registered);
  const unlinked = model.columns.flatMap((column) => {
    const target = column.references?.table;
    if (!target || linked.columns.find((c) => c.key === column.key)?.references) return [];
    return [`${column.key} → ${target}`];
  });
  const exportName = exportNameOf(name);
  const fileBase = fileBaseOf(exportName);
  const entry = renderResourceEntry(linked, JSON.stringify(model.exportName), {
    hidden: options.hidden,
    ...(name === model.exportName ? {} : { name }),
  });
  const content = [
    'import { resource } from "@flowpanel/kit";',
    "",
    `export const ${exportName} = ${entry};`,
    "",
  ].join("\n");
  const index = await readOrNull(path.join(absoluteDir, "index.ts"));
  return {
    unlinked,
    intents: [
      { path: path.join(relativeDir, `${fileBase}.ts`), content },
      {
        path: path.join(relativeDir, "index.ts"),
        content: appendToIndex(index, exportName, fileBase),
        ...(index === null ? {} : { expectedContent: index }),
      },
    ],
  };
}

/** The model `resource` names in schema.prisma, the name it registers under, and its `--dir` plan. */
export async function planPrismaModelIntoDir(
  cwd: string,
  resource: string,
  options: NewIntoDirOptions & { registered: ReadonlyMap<string, string> },
): Promise<NewIntoDirPlan & { name: string; model: string }> {
  const models = await describePrismaSchema(cwd);
  if (models.length === 0) throw new Error("--dir reads schema.prisma, and none was found.");
  const model = findPrismaModel(models, resource);
  if (!model) {
    throw new Error(
      `schema.prisma has no model named "${resource}".\nModels: ${models.map((m) => m.exportName).join(", ")}`,
    );
  }
  const name = prismaResourceName(model);
  const planned = await planPrismaIntoDir(cwd, { ...options, model, name });
  return { ...planned, name, model: model.exportName };
}
