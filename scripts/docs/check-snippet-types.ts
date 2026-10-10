import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { type ClassifiedCodeBlock, classifyCodeBlocks } from "./check-snippets";
import { walkFiles } from "./files";
import { GENERATED_DIR } from "./generate-init-snippets";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const site = join(root, "apps/site");
const DOCS_ROOT = join(site, "content/docs");
const snippets = join(site, "content/snippets");
const fixtures = join(snippets, "fixtures");
/** The reader's project: `flowpanel.config.ts` at its root, the app under `src/`, `@/*` mapped to `./src/*`. */
const project = join(snippets, ".generated");
const src = join(project, "src");

type Adapter = "drizzle" | "prisma";

export interface DocBlock {
  page: string;
  /** Line of the opening fence in the page. */
  line: number;
  file: string;
  adapter: Adapter;
  /** Lines the wrapper adds above the block's first line. */
  offset: number;
  /** The block is a file the reader creates, named on its first line, so it must compile as written. */
  declared: boolean;
}

/** Modules the docs read from the reader's app; a block that names one without importing it gets the import. */
const FIXTURE_IMPORTS: Record<string, string> = {
  schema: 'import * as schema from "@/db/schema";',
  db: 'import { db } from "@/db";',
  auth: 'import { auth } from "@/lib/auth";',
  getSession: 'import { getSession } from "@/lib/auth";',
  prisma: 'import { prisma } from "@/lib/prisma";',
  z: 'import { z } from "zod";',
  React: 'import * as React from "react";',
};

/** Where a name a block uses without importing it may come from: the kit, then the reader's own code. */
const AUTO_IMPORT_MODULES = [
  "@flowpanel/kit",
  "@flowpanel/kit/react",
  "@flowpanel/kit/next",
  "@flowpanel/kit/drizzle",
  "@flowpanel/kit/prisma",
  "@flowpanel/kit/auth",
  "@flowpanel/kit/client",
  "@flowpanel/kit/charts",
  "@flowpanel/kit/publish",
  "@flowpanel/kit/test",
  "@/lib/your-code",
  "@/db/schema",
];

const MISSING_NAME = new Set([2304, 2552, 2582, 18004]);

/** `// src/admin/enums.ts` on a block's first line: the project file the reader creates. */
export function declaredPath(code: string): string | null {
  return /^\/\/ ([\w./[\]-]+\.tsx?)\s*$/.exec(code.split("\n")[0] ?? "")?.[1] ?? null;
}

function adapterOf(block: ClassifiedCodeBlock): Adapter {
  if (block.adapter) return block.adapter;
  return /\bprisma(?:Adapter)?\b|@prisma\/client/.test(block.code ?? "") ? "prisma" : "drizzle";
}

/** The functions, type aliases and interfaces a signature listing declares, with their type-parameter counts. */
function declarations(code: string): { functions: string[]; types: Map<string, number> } {
  const file = ts.createSourceFile("listing.ts", code, ts.ScriptTarget.Latest);
  const functions = new Set<string>();
  const types = new Map<string, number>();
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.add(statement.name.text);
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      types.set(statement.name.text, statement.typeParameters?.length ?? 0);
    }
  }
  return { functions: [...functions], types };
}

/**
 * `of="module"`: each `function` signature is declared, then the module's export of that name must
 * be assignable to it; each type must equal the export of that name, generics instantiated with `unknown`.
 */
function signatureCheck(code: string, module: string): string {
  const declared = code.replace(/^(export\s+)?function\s/gm, "$1declare function ");
  const { functions, types } = declarations(code);
  const checks = [
    `import type * as real from "${module}";`,
    ...functions.map(
      (name) =>
        `export const same_${name}: typeof ${name} = null as unknown as typeof real.${name};`,
    ),
    ...[...types].map(([name, params]) => {
      const args = params === 0 ? "" : `<${Array(params).fill("unknown").join(", ")}>`;
      const ours = `${name}${args}`;
      const theirs = `real.${name}${args}`;
      return `export const same_${name}: [${ours}] extends [${theirs}] ? ([${theirs}] extends [${ours}] ? true : false) : false = true;`;
    }),
  ];
  return `${declared}${checks.join("\n")}\nexport {};\n`;
}

/** The module a block is checked as, and how many lines the wrapper puts above its first line. */
export function wrapped(block: ClassifiedCodeBlock): { text: string; offset: number } {
  const code = block.code ?? "";
  if (block.of) return { text: signatureCheck(code, block.of), offset: 0 };
  if (!block.as) return { text: `${code}export {};\n`, offset: 0 };
  return /^\s*[[{(]/.test(code)
    ? { text: `export const block: ${block.as} = (\n${code});\n`, offset: 1 }
    : { text: `export const block: Partial<${block.as}> = {\n${code}};\n`, offset: 1 };
}

/** The page line a zero-based line of a block's module came from. */
export function pageLine(block: Pick<DocBlock, "line" | "offset">, moduleLine: number): number {
  return block.line + 1 + moduleLine - block.offset;
}

/**
 * The reader's project: the fixtures, what the CLI writes, then every checked block. A block whose
 * first line names a project file is that file (the root config stays the fixture's); the last
 * block of a path keeps its name and earlier ones sit beside it, so relative imports resolve.
 */
function writeDocBlocks(docsRoot: string): DocBlock[] {
  rmSync(project, { recursive: true, force: true });
  cpSync(join(fixtures, "src"), src, { recursive: true });
  cpSync(join(GENERATED_DIR, "src"), src, { recursive: true });
  cpSync(join(fixtures, "flowpanel.config.ts"), join(project, "flowpanel.config.ts"));
  const blocks = walkFiles(docsRoot, ".mdx").flatMap((mdx) => {
    const page = relative(docsRoot, mdx).replaceAll("\\", "/");
    return classifyCodeBlocks(readFileSync(mdx, "utf8"), page)
      .blocks.filter((block) => block.kind === "checked" && block.code !== undefined)
      .map((block) => {
        const path = block.as || block.of ? null : declaredPath(block.code ?? "");
        return { page, block, path, claims: path !== null && path !== "flowpanel.config.ts" };
      });
  });
  const lastOfPath = new Map(
    blocks.flatMap((entry, index) => (entry.claims ? [[entry.path, index] as const] : [])),
  );
  return blocks.map(({ page, block, path, claims }, index) => {
    const ownName = `${page.replace(/\.mdx$/, "").replaceAll("/", "--")}.L${block.line}.${block.language}`;
    const file =
      path && claims
        ? join(
            project,
            lastOfPath.get(path) === index ? path : path.replace(/\.(tsx?)$/, `.L${block.line}.$1`),
          )
        : join(project, ownName);
    mkdirSync(dirname(file), { recursive: true });
    const { text, offset } = wrapped(block);
    writeFileSync(file, text);
    return {
      page,
      line: block.line,
      file: resolve(file),
      adapter: adapterOf(block),
      offset,
      declared: path !== null,
    };
  });
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = join(site, "tsconfig.docs-snippets.json");
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!parsed) throw new Error(`Cannot read ${configPath}`);
  return parsed.options;
}

/** Every export of the auto-import modules, and whether it is a value, read from their declarations. */
function autoImports(program: ts.Program): Map<string, { from: string; value: boolean }> {
  const checker = program.getTypeChecker();
  const found = new Map<string, { from: string; value: boolean }>();
  for (const entry of AUTO_IMPORT_MODULES) {
    const resolved = ts.resolveModuleName(
      entry,
      join(src, "index.ts"),
      program.getCompilerOptions(),
      ts.sys,
    ).resolvedModule;
    const source = resolved && program.getSourceFile(resolved.resolvedFileName);
    const module = source && checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const symbol of checker.getExportsOfModule(module)) {
      if (found.has(symbol.name)) continue;
      const target =
        symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      found.set(symbol.name, { from: entry, value: (target.flags & ts.SymbolFlags.Value) !== 0 });
    }
  }
  return found;
}

function missingName(diagnostic: ts.Diagnostic): string | null {
  if (!MISSING_NAME.has(diagnostic.code)) return null;
  return (
    /'([\w$]+)'/.exec(ts.flattenDiagnosticMessageText(diagnostic.messageText, " "))?.[1] ?? null
  );
}

/** The imports a block leaves out, for names that are a kit export or a fixture of the reader's app. */
function importsFor(
  names: ReadonlySet<string>,
  kit: Map<string, { from: string; value: boolean }>,
): string[] {
  const bySource = new Map<string, string[]>();
  const lines: string[] = [];
  for (const name of [...names].sort()) {
    const fixture = FIXTURE_IMPORTS[name];
    if (fixture) {
      lines.push(fixture);
      continue;
    }
    const exported = kit.get(name);
    if (!exported) continue;
    const list = bySource.get(exported.from) ?? [];
    list.push(exported.value ? name : `type ${name}`);
    bySource.set(exported.from, list);
  }
  for (const [from, list] of bySource) lines.push(`import { ${list.join(", ")} } from "${from}";`);
  return lines;
}

/** Where a diagnostic is: the page line for a docs block, the file line for anything else. */
function where(diagnostic: ts.Diagnostic, blocks: Map<string, DocBlock>): string {
  const file = diagnostic.file;
  if (!file || diagnostic.start === undefined) return "tsconfig.docs-snippets.json";
  const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start);
  const block = blocks.get(resolve(file.fileName));
  if (block) {
    return `apps/site/content/docs/${block.page}:${pageLine(block, line)}:${character + 1}`;
  }
  const inProject = relative(project, file.fileName);
  const source = [join(GENERATED_DIR, inProject), join(fixtures, inProject)].find(existsSync);
  return `${relative(root, source ?? file.fileName)}:${line + 1}:${character + 1}`;
}

/** The included snippets and fixtures one adapter's program checks, besides the docs' own blocks. */
function snippetFiles(adapter: Adapter): string[] {
  const own = [...walkFiles(snippets, ".ts"), ...walkFiles(snippets, ".tsx")].filter(
    (file) =>
      !file.startsWith(project) &&
      !file.startsWith(fixtures) &&
      !file.startsWith(join(GENERATED_DIR, "src")),
  );
  return [
    join(fixtures, "prisma-client.d.ts"),
    join(fixtures, `register-${adapter}.ts`),
    join(src, "lib/your-code.ts"),
    ...(adapter === "drizzle" ? [join(project, "flowpanel.config.ts")] : []),
    ...own.filter((file) => /prisma/.test(file) === (adapter === "prisma")),
  ];
}

/** Typechecks every checked block of the docs, the included snippets and the fixtures; one line per error. */
export function checkDocBlocks(docsRoot = DOCS_ROOT): string[] {
  const blocks = writeDocBlocks(docsRoot);
  const byFile = new Map(blocks.map((block) => [block.file, block]));
  const options = compilerOptions();
  const errors: string[] = [];
  let kit: Map<string, { from: string; value: boolean }> | null = null;
  for (const adapter of ["drizzle", "prisma"] as const) {
    const rootNames = [
      ...snippetFiles(adapter),
      ...blocks.filter((block) => block.adapter === adapter).map((block) => block.file),
    ];
    const first = ts.createProgram({ rootNames, options });
    kit ??= autoImports(first);
    let patched = false;
    for (const file of rootNames) {
      const block = byFile.get(file);
      const source = first.getSourceFile(file);
      if (!block || block.declared || !source) continue;
      const names = new Set(
        ts
          .getPreEmitDiagnostics(first, source)
          .map(missingName)
          .filter((name): name is string => name !== null),
      );
      const imports = importsFor(names, kit);
      if (imports.length === 0) continue;
      writeFileSync(file, `${readFileSync(file, "utf8")}${imports.join("\n")}\n`);
      patched = true;
    }
    const program = patched ? ts.createProgram({ rootNames, options, oldProgram: first }) : first;
    for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
      errors.push(
        `${where(diagnostic, byFile)} TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`,
      );
    }
  }
  return [...new Set(errors)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(join(root, "packages/flowpanel/dist/index.d.ts"))) {
    console.error(
      "✗ Build @flowpanel/kit first: the docs are typechecked against its declarations.",
    );
    process.exit(1);
  }
  const errors = checkDocBlocks();
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} type error(s) in documentation code:\n`);
    for (const error of errors) console.error(`  ${error}`);
    process.exitCode = 1;
  } else {
    console.log("✔ every TypeScript block in the docs typechecks");
  }
}
