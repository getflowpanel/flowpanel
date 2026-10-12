import * as fs from "node:fs/promises";
import * as path from "node:path";
import { type CallExpression, Node, Project, SyntaxKind } from "ts-morph";
import { configProblem } from "../utils/config-problem";
import { resolveProjectModule } from "../utils/module-path";

/** Whether a config or resource-file source registers `resourceName` through a `resource(...)` call. */
export function definesResource(
  source: string,
  resourceName: string,
  filename = "flowpanel.config.ts",
): boolean {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(filename, source);
  return sf.getDescendantsOfKind(SyntaxKind.CallExpression).some((node) => {
    if (node.getExpression().getText().trim() !== "resource") return false;
    const text = node.getArguments()[0]?.getText().trim();
    if (!text) return false;
    const dotted = /\.([A-Za-z_][\w$]*)\s*$/.exec(text)?.[1];
    const quoted = /^["'`]([\w-]+)["'`]$/.exec(text)?.[1];
    return dotted === resourceName || quoted === resourceName || text === resourceName;
  });
}

/** Comments the `dashboard({ path: "<dashboardPath>", … })` call out of a config. */
export function editConfigToCommentDashboard(
  source: string,
  dashboardPath: string,
  filename = "flowpanel.config.ts",
  appDir = "app",
  adminPath = "/admin",
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(filename, source);

  const matches: CallExpression[] = [];
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (callee.getText().trim() !== "dashboard") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first || !Node.isObjectLiteralExpression(first)) return;
    const pathProp = first.getProperty("path");
    if (!pathProp || !Node.isPropertyAssignment(pathProp)) return;
    const init = pathProp.getInitializer();
    if (!init) return;
    const initText = init.getText().trim();
    const stringMatch = /^["'`](.+)["'`]$/.exec(initText);
    if (!stringMatch) return;
    if (stringMatch[1] !== dashboardPath) return;
    matches.push(node);
  });

  if (matches.length === 0) {
    throw new Error(
      configProblem("dashboards", `no dashboard with path "${dashboardPath}" in ${filename}.`),
    );
  }

  const slug = dashboardPath === "/" ? "" : dashboardPath;
  const trimmed = commentOutAll(source, matches).replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: ${appDir}${adminPath}${slug}\n`;
}

/** Applied back-to-front so each call's offsets stay valid against `source`. */
function commentOutAll(source: string, calls: CallExpression[]): string {
  return [...calls]
    .sort((a, b) => b.getStart() - a.getStart())
    .reduce((acc, call) => commentOutCall(acc, call), source);
}

/** The call plus the comma that separates it from the next array element. */
function spanOf(source: string, call: CallExpression): { start: number; end: number } {
  const start = call.getStart();
  let cursor = call.getEnd();
  while (/[ \t]/.test(source[cursor] ?? "")) cursor++;
  return { start, end: source[cursor] === "," ? cursor + 1 : call.getEnd() };
}

function commentOutCall(source: string, call: CallExpression): string {
  const parent = call.getParent();
  if (!parent || !Node.isArrayLiteralExpression(parent)) {
    throw new Error(
      `eject: ${call.getExpression().getText()}(...) at offset ${call.getStart()} is not an array entry, so it cannot be turned off automatically. Remove it from the config by hand.`,
    );
  }

  const { start, end } = spanOf(source, call);
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const indent = source.slice(lineStart, start);
  let lineEnd = end;
  while (/[ \t]/.test(source[lineEnd] ?? "")) lineEnd++;
  const endsTheLine =
    lineEnd >= source.length || source[lineEnd] === "\n" || source[lineEnd] === "\r";

  // An entry sharing a line with other code gets a block comment instead of a line comment.
  if (!/^[ \t]*$/.test(indent) || !endsTheLine) {
    return `${source.slice(0, start)}/* ${source.slice(start, end)} */${source.slice(end)}`;
  }

  const commented = source
    .slice(start, end)
    .split("\n")
    .map((line, i) => {
      const body = i === 0 ? line : stripIndent(line, indent);
      return body.length === 0 ? `${indent}//` : `${indent}// ${body}`;
    })
    .join("\n");
  return `${source.slice(0, lineStart)}${commented}${source.slice(end)}`;
}

function stripIndent(line: string, indent: string): string {
  return line.startsWith(indent) ? line.slice(indent.length) : line.replace(/^[ \t]*/, "");
}

/** The directory a config's `resources` property is imported from, when it is not an array literal. */
export async function findSplitResourcesDir(
  cwd: string,
  configFile: string,
  source: string,
): Promise<string | null> {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile("flowpanel.config.ts", source);
  for (const declaration of sf.getImportDeclarations()) {
    const named = declaration
      .getNamedImports()
      .find((specifier) => specifier.getName() === "resources");
    if (!named) continue;
    const resolved = await resolveProjectModule(
      cwd,
      declaration.getModuleSpecifierValue(),
      configFile,
    );
    if (resolved) return path.dirname(resolved);
  }
  return null;
}

/** The file in a split-resources directory that registers `resourceName`, or `null`. */
export async function findSplitResourceFile(
  dir: string,
  resourceName: string,
): Promise<string | null> {
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  for (const name of names.filter((n) => /\.tsx?$/.test(n) && !/^index\.tsx?$/.test(n))) {
    const file = path.join(dir, name);
    if (definesResource(await fs.readFile(file, "utf8"), resourceName, name)) return file;
  }
  return null;
}
