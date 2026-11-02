import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { walkFiles } from "./files";
import { GENERATED_DIR } from "./generate-init-snippets";

/** Pages a reader follows step by step; each step that ends in "You should see" must boot. */
export const TUTORIALS = ["introduction/founder-admin.mdx"];

/** Modules that load in Next.js only, replaced like a missing package. */
const NEXT_ONLY = new Set(["next/font/google", "next/font/local"]);

const FIXTURE = [
  "const __fixture = (name) =>",
  "  new Proxy(function () {}, {",
  "    get: (_target, key) =>",
  '      key === "then" ? undefined',
  '      : key === Symbol.toPrimitive ? () => name.replace(/\\W+/g, "_")',
  '      : __fixture(name + "." + String(key)),',
  '    apply: () => __fixture(name + "()"),',
  '    construct: () => __fixture("new " + name),',
  "  });",
  "",
].join("\n");

const BOOT_TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      target: "es2022",
      module: "esnext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      paths: { "@/*": ["./src/*"] },
    },
  },
  null,
  2,
)}\n`;

export interface BootEntry {
  /** The file to import, relative to the project root. */
  file: string;
  /** Where a failure is reported. */
  at: string;
}

function isDeclared(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword)
  );
}

function isExported(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function declaredNames(statement: ts.Statement): string[] {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : [],
    );
  }
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
    return [statement.name.text];
  }
  return [];
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

function installed(specifier: string, from: string): boolean {
  if (NEXT_ONLY.has(specifier)) return false;
  if (isBuiltin(specifier)) return true;
  const name = packageName(specifier);
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, "node_modules", name, "package.json"))) return true;
    if (dirname(dir) === dir) return false;
  }
}

function isBare(specifier: string): boolean {
  return !specifier.startsWith(".") && !specifier.startsWith("/") && !specifier.startsWith("@/");
}

function stubPath(specifier: string): string {
  return `__stubs__/${specifier.replace(/[^\w.-]+/g, "_")}.ts`;
}

/** Fixture declares become stand-ins; imports of packages the site lacks point at stubs. */
function runnable(
  source: string,
  file: string,
  root: string,
  stubs: Map<string, Set<string>>,
): string {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const done = new Set<string>();
  for (const statement of sf.statements) {
    if (ts.isModuleDeclaration(statement)) continue;
    if (isDeclared(statement)) {
      const names = declaredNames(statement).filter((name) => !done.has(name));
      for (const name of names) done.add(name);
      const exported = isExported(statement) ? "export " : "";
      edits.push({
        start: statement.getStart(sf),
        end: statement.getEnd(),
        text: names.map((name) => `${exported}const ${name} = __fixture("${name}");`).join("\n"),
      });
      continue;
    }
    const target =
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier
        : null;
    if (!target || !isBare(target.text) || installed(target.text, dirname(file))) continue;
    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
    const names = stubs.get(target.text) ?? new Set<string>();
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    if (clause?.name) names.add("default");
    const bindings = ts.isImportDeclaration(statement)
      ? clause?.namedBindings
      : statement.exportClause;
    if (bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) names.add((element.propertyName ?? element.name).text);
      }
    }
    stubs.set(target.text, names);
    const to = relative(dirname(file), join(root, stubPath(target.text))).replaceAll("\\", "/");
    edits.push({
      start: target.getStart(sf),
      end: target.getEnd(),
      text: JSON.stringify(to.startsWith(".") ? to : `./${to}`),
    });
  }
  let text = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  }
  return done.size > 0 ? `${FIXTURE}${text}` : text;
}

/** Writes `files` (project-relative path → source) as a project that Node can run through tsx. */
export function writeBootProject(
  root: string,
  files: ReadonlyMap<string, string>,
  moduleType: "module" | "commonjs" = "module",
): void {
  rmSync(root, { recursive: true, force: true });
  const stubs = new Map<string, Set<string>>();
  for (const [path, source] of files) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    const code = /\.tsx?$/.test(path) && !path.endsWith(".d.ts");
    writeFileSync(file, code ? runnable(source, file, root, stubs) : source);
  }
  for (const [specifier, names] of stubs) {
    const file = join(root, stubPath(specifier));
    mkdirSync(dirname(file), { recursive: true });
    const exports = [...names]
      .filter((name) => name !== "default")
      .map((name) => `export const ${name} = __fixture("${specifier}.${name}");`);
    writeFileSync(
      file,
      `${FIXTURE}${exports.join("\n")}\nexport default __fixture("${specifier}");\n`,
    );
  }
  writeFileSync(join(root, "tsconfig.json"), BOOT_TSCONFIG);
  writeFileSync(join(root, "package.json"), `${JSON.stringify({ type: moduleType })}\n`);
}

function resolveLocal(root: string, from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(root, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (base === null) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((file) => /\.tsx?$/.test(file) && existsSync(file)) ?? null;
}

/** The specifiers a file imports when it runs; type-only imports are erased. */
function runtimeImports(file: string): string[] {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  return sf.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      const typesOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (!clause.name &&
            bindings !== undefined &&
            ts.isNamedImports(bindings) &&
            bindings.elements.every((element) => element.isTypeOnly)));
      return typesOnly ? [] : [statement.moduleSpecifier.text];
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.isTypeOnly &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [statement.moduleSpecifier.text];
    }
    return [];
  });
}

/** Whether `entry` reaches `@flowpanel/kit/publish` through the project's own imports. */
function publishes(root: string, entry: string): boolean {
  const seen = new Set<string>();
  const visit = (file: string): boolean => {
    if (seen.has(file)) return false;
    seen.add(file);
    return runtimeImports(file).some((specifier) => {
      if (specifier === "@flowpanel/kit/publish") return true;
      const next = resolveLocal(root, file, specifier);
      return next !== null && visit(next);
    });
  };
  return visit(join(root, entry));
}

/** A Redis stand-in for one worker run: it answers what ioredis sends and reports each PUBLISH channel. */
const REDIS_STUB = `
const net = require("node:net");
const channels = [];
const reply = (socket, args) => {
  const name = String(args[0] ?? "").toUpperCase();
  if (name === "INFO") return socket.write("$21\\r\\n# Server\\r\\nloading:0\\r\\n\\r\\n");
  if (name === "PUBLISH") {
    channels.push(args[1]);
    return socket.write(":0\\r\\n");
  }
  socket.write("+OK\\r\\n");
  if (name === "QUIT") socket.end();
};
const server = net.createServer((socket) => {
  let buffer = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    for (;;) {
      const lines = buffer.split("\\r\\n");
      const count = Number((lines[0] ?? "").slice(1));
      if (!lines[0]?.startsWith("*") || lines.length < count * 2 + 2) return;
      const args = [];
      for (let i = 0; i < count; i++) args.push(lines[2 + i * 2]);
      buffer = lines.slice(count * 2 + 1).join("\\r\\n");
      reply(socket, args);
    }
  });
});
server.listen(Number(process.env.REDIS_STUB_PORT), "127.0.0.1");
server.unref();
process.on("exit", () => console.error("__channels " + JSON.stringify(channels)));
`;

/** The port the Redis stand-in listens on, inside the range this check may use. */
const REDIS_STUB_PORT = 3649;

/**
 * Runs a worker script as `pnpm tsx` runs it in a create-next-app project: CommonJS and no
 * NODE_ENV. It must exit, and publish under a prefix that names no unset variable.
 */
function runWorker(root: string, script: string, at: string): string[] {
  const stub = join(root, "__redis-stub.cjs");
  writeFileSync(stub, REDIS_STUB);
  const { NODE_ENV: _mode, ...env } = process.env;
  const result = spawnSync(process.execPath, ["--require", stub, "--import", "tsx", script], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...env,
      TSX_TSCONFIG_PATH: join(root, "tsconfig.json"),
      DATABASE_URL: "postgres://docs:docs@127.0.0.1:9/docs",
      REDIS_URL: `redis://127.0.0.1:${REDIS_STUB_PORT}`,
      REDIS_STUB_PORT: String(REDIS_STUB_PORT),
    },
  });
  if (result.error) return [`${at} ${script} did not finish: ${result.error.message}`];
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const code = /\b(ERR_[A-Z_]+)\b.*/.exec(output)?.[0];
  if (result.status !== 0 || code) {
    const reason = code ?? output.trim().split("\n").slice(-3).join(" ");
    return [`${at} ${script} fails as CommonJS: ${reason}`];
  }
  const line = /__channels (.*)/.exec(output)?.[1];
  const channels: string[] = line ? JSON.parse(line) : [];
  if (channels.length === 0) return [`${at} ${script} published nothing`];
  const unset = channels.filter((channel) => channel.includes("undefined"));
  return unset.length > 0 ? [`${at} ${script} publishes to ${unset.join(", ")}`] : [];
}

/** Every import cycle among the project's own files reachable from `entry`, as `a.ts → b.ts → a.ts`. */
export function importCycles(root: string, entry: string): string[] {
  const cycles = new Set<string>();
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const visit = (file: string): void => {
    state.set(file, "open");
    stack.push(file);
    for (const fileName of runtimeImports(file)) {
      const next = resolveLocal(root, file, fileName);
      if (next === null) continue;
      if (state.get(next) === "open") {
        const loop = [...stack.slice(stack.indexOf(next)), next];
        cycles.add(loop.map((f) => relative(root, f).replaceAll("\\", "/")).join(" → "));
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(file, "done");
  };
  visit(join(root, entry));
  return [...cycles];
}

const RUNNER = `
for (const file of process.argv.slice(1)) {
  try {
    const loaded = await import(new URL(file, "file://" + process.cwd() + "/").href);
    if (!loaded.default) throw new Error("it has no default export");
    console.log(JSON.stringify({ file, error: null }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ file, error: message.split("\\n").slice(0, 4).join(" ") }));
  }
}
`;

/** Imports each entry in a fresh Node process, as `next dev` would load the config; one line per failure. */
export function bootEntries(root: string, entries: readonly BootEntry[]): string[] {
  if (entries.length === 0) return [];
  const problems: string[] = [];
  for (const entry of entries) {
    for (const cycle of importCycles(root, entry.file)) {
      problems.push(`${entry.at} import cycle: ${cycle}`);
    }
  }
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", RUNNER, ...entries.map((e) => e.file)],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "development",
        TSX_TSCONFIG_PATH: join(root, "tsconfig.json"),
        DATABASE_URL: "postgres://docs:docs@127.0.0.1:9/docs",
        REDIS_URL: "redis://127.0.0.1:9",
      },
    },
  );
  const outcomes = new Map<string, string | null>();
  for (const line of (result.stdout ?? "").split("\n")) {
    if (!line.startsWith('{"file"')) continue;
    const { file, error } = JSON.parse(line) as { file: string; error: string | null };
    outcomes.set(file, error);
  }
  for (const entry of entries) {
    if (!outcomes.has(entry.file)) {
      const reason = result.error?.message ?? (result.stderr ?? "").trim().split("\n")[0];
      problems.push(`${entry.at} did not finish loading: ${reason || "no output"}`);
      continue;
    }
    const error = outcomes.get(entry.file);
    if (error) problems.push(`${entry.at} fails at startup: ${error}`);
  }
  return problems;
}

/** Reads a project directory into the map `writeBootProject` takes, leaving out `skip`. */
export function projectFiles(dir: string, skip: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const file of [...walkFiles(dir, ".ts"), ...walkFiles(dir, ".tsx")]) {
    if (file.startsWith(skip)) continue;
    files.set(relative(dir, file).replaceAll("\\", "/"), readFileSync(file, "utf8"));
  }
  return files;
}

export interface TutorialStep {
  heading: string;
  /** Line of the step's heading in the page. */
  line: number;
  /** The reader's project at the end of the step: path → source. */
  files: Map<string, string>;
  /** The files the step runs with `pnpm tsx`. */
  scripts: string[];
}

const FIRST_LINE_PATH = /^\/\/ ([\w./[\]-]+\.tsx?)\s*$/;

function generated(path: string): string {
  const file = join(GENERATED_DIR, path);
  if (!existsSync(file)) throw new Error(`no generated snippet ${relative(GENERATED_DIR, file)}`);
  return readFileSync(file, "utf8");
}

/** What a shell line in the tutorial does to the project: the `init`, `new`, `mv` and `echo` it models. */
function applyCommand(line: string, files: Map<string, string>, scripts: string[]): void {
  const tsx = /^pnpm tsx (?:--\S+ )*(\S+\.tsx?)$/.exec(line);
  if (tsx) {
    scripts.push(tsx[1] ?? "");
    return;
  }
  const echo = /^echo '(.*)' > (\S+)$/.exec(line);
  if (echo) {
    files.set(echo[2] ?? "", `${echo[1]}\n`);
    return;
  }
  const words = line.split(/\s+/);
  if (words[0] === "mv" && words.length === 3) {
    const from = words[1] ?? "";
    const source = files.get(from);
    if (source === undefined) throw new Error(`\`${line}\` moves a file the tutorial never wrote`);
    files.delete(from);
    files.set(words[2] ?? "", source);
    return;
  }
  const cli = line.match(/^pnpm (?:dlx @flowpanel\/cli|flowpanel) (\w+)(.*)$/);
  if (!cli) return;
  const [, command, rest = ""] = cli;
  if (command === "init") {
    if (!rest.includes("--dev-auth")) {
      throw new Error("the tutorial check models `init --dev-auth` only");
    }
    files.set("flowpanel.config.ts", generated("init/dev-auth-config.ts"));
    files.set("src/server/lib/auth.ts", generated("init/dev-session.ts"));
    return;
  }
  if (command === "new") {
    const table = /^\s+(\w+)/.exec(rest)?.[1];
    const dir = /--dir\s+(\S+)/.exec(rest)?.[1];
    if (!table || !dir)
      throw new Error(`\`${line}\`: the tutorial check models \`new <table> --dir\``);
    if (!files.has(`${dir}/index.ts`)) {
      files.set("src/admin/config/index.ts", generated("src/admin/config/index.ts"));
    }
    files.set(`${dir}/${table}.ts`, generated(`${dir}/${table}.ts`));
    files.set(`${dir}/index.ts`, generated(`${dir}/index.ts`));
  }
}

/** The project a reader has after each step that says what they should see. */
export function tutorialSteps(source: string): TutorialStep[] {
  const lines = source.split("\n");
  const files = new Map<string, string>();
  const steps: TutorialStep[] = [];
  let heading: { text: string; line: number } | null = null;
  let claims = false;
  let scripts: string[] = [];
  const close = (): void => {
    if (heading && claims)
      steps.push({ heading: heading.text, line: heading.line, files: new Map(files), scripts });
  };
  for (let index = 0; index < lines.length; index++) {
    const text = lines[index] ?? "";
    const title = /^## (.+)$/.exec(text);
    if (title) {
      close();
      heading = { text: title[1] ?? "", line: index + 1 };
      claims = false;
      scripts = [];
      continue;
    }
    if (/You should see/.test(text)) claims = true;
    const fence = /^```(\w+)(.*)$/.exec(text);
    if (!fence) continue;
    const body: string[] = [];
    for (index++; index < lines.length && !/^```\s*$/.test(lines[index] ?? ""); index++) {
      body.push(lines[index] ?? "");
    }
    const [, language, meta = ""] = fence;
    if (language === "bash") {
      for (const command of body) applyCommand(command.trim(), files, scripts);
    } else if ((language === "ts" || language === "tsx") && meta.trim() === "") {
      const path = FIRST_LINE_PATH.exec(body[0] ?? "")?.[1];
      if (path) files.set(path, `${body.join("\n")}\n`);
    }
  }
  close();
  return steps;
}

/** Boots the tutorial at each step that claims a working admin, and runs the worker scripts it runs. */
export function bootTutorial(page: string, source: string, bootRoot: string): string[] {
  let steps: TutorialStep[];
  try {
    steps = tutorialSteps(source);
  } catch (err) {
    return [`apps/site/content/docs/${page}:1 ${err instanceof Error ? err.message : String(err)}`];
  }
  return steps.flatMap((step, index) => {
    const root = join(bootRoot, `${page.replace(/\W+/g, "-")}-${index + 1}`);
    const at = `apps/site/content/docs/${page}:${step.line} (${step.heading})`;
    if (!step.files.has("flowpanel.config.ts")) return [`${at} has no flowpanel.config.ts yet`];
    writeBootProject(root, step.files);
    const problems = bootEntries(root, [{ file: "flowpanel.config.ts", at }]);
    const workers = step.scripts.filter((script) => publishes(root, script));
    if (workers.length === 0) return problems;
    const cjs = `${root}-cjs`;
    writeBootProject(cjs, step.files, "commonjs");
    return [...problems, ...workers.flatMap((script) => runWorker(cjs, script, at))];
  });
}
