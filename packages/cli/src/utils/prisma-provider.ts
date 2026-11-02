import * as fs from "node:fs/promises";
import * as path from "node:path";
import { detectPathAlias, type PathAliasMode, specifierFrom } from "./detect";

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

/** Where `prisma` looks for the schema: prisma.config.* first, then package.json#prisma.schema. */
async function configuredLocations(cwd: string): Promise<string[]> {
  const locations: string[] = [];
  for (const name of CONFIG_FILES) {
    const source = await fs.readFile(path.join(cwd, name), "utf8").catch(() => null);
    if (source === null) continue;
    const literal = /\bschema\s*:\s*(["'`])([^"'`]+)\1/.exec(source)?.[2];
    const joined = /\bschema\s*:\s*(?:path\.)?(?:join|resolve)\(([^)]*)\)/.exec(source)?.[1];
    const parts = joined ? [...joined.matchAll(/(["'`])([^"'`]+)\1/g)].map((m) => m[2]) : [];
    if (literal) locations.push(literal);
    else if (parts.length > 0) locations.push(parts.join("/"));
  }
  const manifest = await fs.readFile(path.join(cwd, "package.json"), "utf8").catch(() => "{}");
  try {
    const declared = (JSON.parse(manifest) as { prisma?: { schema?: unknown } }).prisma?.schema;
    if (typeof declared === "string") locations.push(declared);
  } catch {}
  return locations;
}

/** The `.prisma` files of the first schema location that has any. */
export async function findPrismaSchemaFiles(cwd: string): Promise<string[]> {
  for (const location of [...(await configuredLocations(cwd)), ...DEFAULT_SCHEMAS]) {
    const files = await schemaFilesAt(cwd, location);
    if (files.length > 0) return files;
  }
  return [];
}

interface ClientGenerator {
  provider: "prisma-client-js" | "prisma-client";
  /** The schema file that declares it, project-relative. */
  file: string;
  /** `output` as written in the schema, and the project-relative directory it names. */
  output?: { written: string; dir: string };
}

/** The client generator of the project's Prisma schema; `prisma-client-js` wins over the newer `prisma-client`. */
export async function detectClientGenerator(cwd: string): Promise<ClientGenerator | null> {
  let found: ClientGenerator | null = null;
  for (const file of await findPrismaSchemaFiles(cwd)) {
    const source = stripLineComments(await fs.readFile(file, "utf8").catch(() => ""));
    for (const block of source.matchAll(/generator\s+\w+\s*\{([^}]*)\}/g)) {
      const provider = /\bprovider\s*=\s*"([^"]+)"/.exec(block[1] ?? "")?.[1];
      if (provider !== "prisma-client-js" && provider !== "prisma-client") continue;
      const written = /\boutput\s*=\s*"([^"]+)"/.exec(block[1] ?? "")?.[1];
      const projectPath = (target: string) => path.relative(cwd, target).split(path.sep).join("/");
      const generator: ClientGenerator = {
        provider,
        file: projectPath(file),
        ...(written
          ? { output: { written, dir: projectPath(path.resolve(path.dirname(file), written)) } }
          : {}),
      };
      if (provider === "prisma-client-js") return generator;
      found ??= generator;
    }
  }
  return found;
}

/** The module `PrismaClient` and the model types come from: the generator's `output`, or `@prisma/client`. */
export function prismaClientModule(
  generator: ClientGenerator | null,
  fromFile: string,
  mode: PathAliasMode,
): string {
  if (!generator?.output) return "@prisma/client";
  const dir = generator.output.dir;
  return specifierFrom(
    fromFile,
    generator.provider === "prisma-client" ? `${dir}/client` : dir,
    mode,
  );
}

/** Where project file `file` imports the Prisma model types from. */
export async function prismaClientModuleFor(cwd: string, file: string): Promise<string> {
  const relative = path.relative(cwd, file).split(path.sep).join("/");
  return prismaClientModule(await detectClientGenerator(cwd), relative, await detectPathAlias(cwd));
}

/** The provider of the project's Prisma `datasource`, read from the schema `prisma` itself would load. */
export async function detectPrismaProvider(cwd: string): Promise<ProviderLookup> {
  for (const file of await findPrismaSchemaFiles(cwd)) {
    const provider = providerIn(await fs.readFile(file, "utf8").catch(() => ""));
    if (provider === null) continue;
    if (provider === "postgresql" || provider === "postgres") {
      return { status: "found", provider: "postgresql" };
    }
    if (provider === "mysql" || provider === "sqlite") return { status: "found", provider };
    return { status: "unsupported", provider };
  }
  return { status: "missing" };
}
