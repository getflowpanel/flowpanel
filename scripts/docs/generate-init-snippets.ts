import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { guessedPaths } from "../../packages/cli/src/commands/init-detect";
import {
  type ConfigTemplateInput,
  configTemplateCall,
  renderCall,
} from "../../packages/cli/src/commands/init-templates";
import { dirSpecifier, wireResourcesDir } from "../../packages/cli/src/scaffold/config-edits";
import {
  describeSchema,
  type TableDescription,
} from "../../packages/cli/src/scaffold/describe-schema";
import { appendToIndex } from "../../packages/cli/src/scaffold/index-file";
import { fileBaseOf, renderResourceFile } from "../../packages/cli/src/scaffold/render-resource";
import { pmCommands } from "../../packages/cli/src/utils/detect";
import type { DocsProblem } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const site = join(root, "apps/site");
const snippets = join(site, "content/snippets");
/** What the CLI writes, rendered from its own templates; the docs include these files. */
export const GENERATED_DIR = join(snippets, "generated");

/** What `init --yes` answers in a fresh create-next-app project with pnpm and a `src/` directory. */
const INIT_DEFAULTS = {
  adminPath: "/admin",
  apiPath: "/api/flowpanel",
  cli: `${pmCommands("pnpm").exec} flowpanel`,
  provider: "postgresql",
} as const;

function config(input: Omit<ConfigTemplateInput, keyof typeof INIT_DEFAULTS>): Promise<string> {
  return renderCall(configTemplateCall({ ...INIT_DEFAULTS, ...input }));
}

/** The tutorial's tables, in the order its `flowpanel new --dir` commands run. */
const TUTORIAL_TABLES: ReadonlyArray<{ table: string; hidden: boolean }> = [
  { table: "customers", hidden: false },
  { table: "monitors", hidden: false },
  { table: "runs", hidden: false },
  { table: "invoices", hidden: true },
];

/** `table` as `flowpanel new` writes it when the `registered` tables already have their own files. */
function resourceFile(
  tables: readonly TableDescription[],
  name: string,
  registered: ReadonlySet<string>,
  hidden: boolean,
): { base: string; exportName: string; source: string } {
  const table = tables.find((candidate) => candidate.tableName === name);
  if (!table) throw new Error(`The docs schema fixture has no table "${name}".`);
  const linked: TableDescription = {
    ...table,
    columns: table.columns.map((column) => {
      if (!column.references || registered.has(column.references.table)) return column;
      const { references: _references, ...plain } = column;
      return plain;
    }),
  };
  return {
    base: fileBaseOf(table.exportName),
    exportName: table.exportName,
    source: renderResourceFile(linked, { hidden, schemaImport: "@/db/schema" }),
  };
}

/** `flowpanel new <table> --dir` run once per table: each file links the targets already written. */
async function newResources(): Promise<Record<string, string>> {
  const tables = await describeSchema(site, join(snippets, "fixtures/src/db/schema.ts"));
  const registered = new Set<string>();
  const files: Record<string, string> = {
    "new/user-visit.ts": resourceFile(tables, "user_visit", new Set(["user"]), true).source,
  };
  let index: string | null = null;
  for (const { table: name, hidden } of TUTORIAL_TABLES) {
    const { base, exportName, source } = resourceFile(tables, name, registered, hidden);
    files[`src/admin/config/resources/${base}.ts`] = source;
    index = appendToIndex(index, exportName, base);
    registered.add(name);
  }
  files["src/admin/config/resources/index.ts"] = index ?? "";
  return files;
}

/** The specifier `new --dir src/admin/config/resources` writes into the tutorial's config, in a `src/` project. */
async function tutorialResourcesSpecifier(): Promise<string> {
  const project = mkdtempSync(join(tmpdir(), "flowpanel-snippets-"));
  try {
    writeFileSync(
      join(project, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
    );
    return await dirSpecifier(
      project,
      join(project, "src/admin/config/index.ts"),
      join(project, "src/admin/config/resources"),
    );
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
}

/** Every generated file, keyed by its path under `content/snippets/generated`. */
export async function renderInitSnippets(): Promise<Record<string, string>> {
  const drizzle = guessedPaths("drizzle", "strip-src");
  const prisma = guessedPaths("prisma", "strip-src");
  const stub = { appName: "My app", preset: false, session: "stub" } as const;
  const tutorial = await config({
    orm: "drizzle",
    preset: true,
    db: "@/db",
    schema: "@/db/schema",
    auth: "@/server/lib/flowpanel-session",
    appName: "scrapeai",
    session: "own",
  });
  const moved = wireResourcesDir(tutorial, await tutorialResourcesSpecifier(), () => false);
  if (moved.kind !== "wired") throw new Error("new --dir no longer wires the tutorial's config.");
  return {
    "init/drizzle-config.ts": await config({ ...stub, orm: "drizzle", ...drizzle }),
    "init/prisma-config.ts": await config({ ...stub, orm: "prisma", ...prisma }),
    "init/auth-session.ts": await renderCall({ template: "auth-session.ts.txt", vars: {} }),
    "init/better-auth-config.ts": tutorial,
    "src/admin/config/index.ts": moved.source,
    "src/server/lib/flowpanel-session.ts": await renderCall({
      template: "auth-session.better-auth.ts.txt",
      vars: { AUTH_MODULE: "@/lib/auth" },
    }),
    ...(await newResources()),
  };
}

/** Generated files that are missing or no longer match what the CLI writes. */
export async function checkInitSnippets(): Promise<DocsProblem[]> {
  const problems: DocsProblem[] = [];
  for (const [path, content] of Object.entries(await renderInitSnippets())) {
    const file = join(GENERATED_DIR, path);
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current === content) continue;
    problems.push({
      code: "init-snippet-drift",
      file: relative(root, file),
      line: 1,
      message:
        current === null
          ? "Generated snippet of what the CLI writes is missing."
          : "Generated snippet no longer matches what the CLI writes.",
      suggestion: "Run pnpm docs:generate.",
    });
  }
  return problems;
}

async function main(): Promise<void> {
  for (const [path, content] of Object.entries(await renderInitSnippets())) {
    const file = join(GENERATED_DIR, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
