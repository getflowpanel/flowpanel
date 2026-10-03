import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveProjectModule } from "../utils/module-path";
import { readTsconfigOptions } from "../utils/tsconfig";

/** Names a module exports, as far as a source scan can tell. */
function exportedNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(
    /export\s+(?:declare\s+)?(?:const|let|var|function|class)\s+(\w+)/g,
  )) {
    names.add(m[1] as string);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of (m[1] as string).split(",")) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  return names;
}

/** Export name → SQL table name, for every `export const x = pgTable("x_sql", ...)` the scan finds. */
function tableNamesOf(source: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of source.matchAll(
    /export\s+const\s+(\w+)\s*=\s*\w*[Tt]able\(\s*["'`]([\w.-]+)["'`]/g,
  )) {
    found.set(m[1] as string, m[2] as string);
  }
  return found;
}

export type SchemaCheck =
  | { status: "ok"; exportName: string }
  | { status: "missing"; message: string }
  | { status: "unverified"; reason: string };

/** `@/db/schema` under `src/` or the project root, for a host with no tsconfig `paths` at all. */
async function bareAliasFallback(cwd: string, spec: string): Promise<string | null> {
  if (!spec.startsWith("@/")) return null;
  if ((await readTsconfigOptions(cwd))?.paths) return null;
  const bare = spec.slice(2);
  for (const base of [path.join(cwd, "src", bare), path.join(cwd, bare)]) {
    const found = await resolveProjectModule(cwd, base);
    if (found) return found;
  }
  return null;
}

/**
 * Checks the resource maps to a real table before writing it into the config —
 * otherwise `flowpanel new` happily produces a line that cannot compile.
 */
export async function checkSchemaExport(
  cwd: string,
  configFile: string,
  configSource: string,
  name: string,
): Promise<SchemaCheck> {
  const importMatch = /import\s+\*\s+as\s+schema\s+from\s+["']([^"']+)["']/.exec(configSource);
  if (!importMatch) {
    return { status: "unverified", reason: "the config has no `import * as schema` line" };
  }
  const spec = importMatch[1] as string;
  const file =
    (await resolveProjectModule(cwd, spec, configFile)) ?? (await bareAliasFallback(cwd, spec));
  if (!file) {
    return { status: "unverified", reason: `"${spec}" does not resolve to a file under ${cwd}` };
  }
  const source = await fs.readFile(file, "utf8");
  const names = exportedNames(source);
  if (names.size === 0) {
    return {
      status: "unverified",
      reason: `no exports could be read from ${path.relative(cwd, file)}`,
    };
  }
  if (names.has(name)) return { status: "ok", exportName: name };
  const tableNames = tableNamesOf(source);
  const byTableName = [...tableNames.entries()].find(([, tableName]) => tableName === name)?.[0];
  if (byTableName) return { status: "ok", exportName: byTableName };
  const available = [...names].sort().slice(0, 12).join(", ");
  return {
    status: "missing",
    message:
      `${path.relative(cwd, file)} has no export or table named "${name}".\n` +
      (available ? `Exports there: ${available}\n` : "") +
      `Pass the table expression yourself with --table if it lives elsewhere.`,
  };
}
