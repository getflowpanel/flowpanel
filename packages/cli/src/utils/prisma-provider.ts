import * as fs from "node:fs/promises";
import * as path from "node:path";

export type PrismaProvider = "postgresql" | "mysql" | "sqlite";

export type ProviderLookup =
  | { status: "found"; provider: PrismaProvider }
  | { status: "unsupported"; provider: string }
  | { status: "missing" };

const CONFIG_FILES = ["ts", "mts", "cts", "js", "mjs", "cjs"].map((ext) => `prisma.config.${ext}`);
const DEFAULT_SCHEMAS = ["prisma/schema.prisma", "schema.prisma", "prisma/schema"];

/** Drops `//` comments, leaving a `//` inside a string literal alone. */
function stripLineComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === "\\") i++;
        else if (line[i] === '"') quoted = !quoted;
        else if (!quoted && line[i] === "/" && line[i + 1] === "/") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

function providerIn(source: string): string | null {
  for (const block of stripLineComments(source).matchAll(/datasource\s+\w+\s*\{([^}]*)\}/g)) {
    const provider = /\bprovider\s*=\s*"([^"]+)"/.exec(block[1] ?? "")?.[1];
    if (provider) return provider;
  }
  return null;
}

async function schemaFilesAt(cwd: string, location: string): Promise<string[]> {
  const target = path.resolve(cwd, location);
  const stat = await fs.stat(target).catch(() => null);
  if (stat?.isFile()) return [target];
  if (!stat?.isDirectory()) return [];
  const entries = await fs.readdir(target).catch(() => [] as string[]);
  return entries.filter((name) => name.endsWith(".prisma")).map((name) => path.join(target, name));
}

async function configuredLocations(cwd: string): Promise<string[]> {
  const locations: string[] = [];
  const manifest = await fs.readFile(path.join(cwd, "package.json"), "utf8").catch(() => "{}");
  try {
    const declared = (JSON.parse(manifest) as { prisma?: { schema?: unknown } }).prisma?.schema;
    if (typeof declared === "string") locations.push(declared);
  } catch {}
  for (const name of CONFIG_FILES) {
    const source = await fs.readFile(path.join(cwd, name), "utf8").catch(() => null);
    if (source === null) continue;
    const literal = /\bschema\s*:\s*(["'`])([^"'`]+)\1/.exec(source)?.[2];
    const joined = /\bschema\s*:\s*(?:path\.)?(?:join|resolve)\(([^)]*)\)/.exec(source)?.[1];
    const parts = joined ? [...joined.matchAll(/(["'`])([^"'`]+)\1/g)].map((m) => m[2]) : [];
    if (literal) locations.push(literal);
    else if (parts.length > 0) locations.push(parts.join("/"));
  }
  return locations;
}

/** The provider of the project's Prisma `datasource`, read from the schema `prisma` itself would load. */
export async function detectPrismaProvider(cwd: string): Promise<ProviderLookup> {
  for (const location of [...(await configuredLocations(cwd)), ...DEFAULT_SCHEMAS]) {
    for (const file of await schemaFilesAt(cwd, location)) {
      const provider = providerIn(await fs.readFile(file, "utf8").catch(() => ""));
      if (provider === null) continue;
      if (provider === "postgresql" || provider === "postgres") {
        return { status: "found", provider: "postgresql" };
      }
      if (provider === "mysql" || provider === "sqlite") return { status: "found", provider };
      return { status: "unsupported", provider };
    }
  }
  return { status: "missing" };
}
