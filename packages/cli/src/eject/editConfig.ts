import { type CallExpression, Node, Project } from "ts-morph";

/**
 * Comments the `resource(<refMatchingName>, …)` call out of a flowpanel.config.ts
 * source, leaving the entry in place so uncommenting reverts the eject.
 */
export function editConfigToCommentResource(
  source: string,
  resourceName: string,
  filename = "flowpanel.config.ts",
  appDir = "app",
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
    const calleeText = callee.getText().trim();
    if (calleeText !== "resource") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const text = first.getText().trim();

    const dotMatch = /\.([A-Za-z_][\w$]*)\s*$/.exec(text);
    if (dotMatch && dotMatch[1] === resourceName) {
      matches.push(node);
      return;
    }
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      matches.push(node);
      return;
    }
    if (text === resourceName) matches.push(node);
  });

  if (matches.length === 0) {
    throw new Error(`eject: resource "${resourceName}" not found in flowpanel.config.ts`);
  }

  const trimmed = commentOutAll(source, matches).replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: ${appDir}/admin/${resourceName}\n`;
}

/** Comments the `dashboard({ path: "<dashboardPath>", … })` call out of a config. */
export function editConfigToCommentDashboard(
  source: string,
  dashboardPath: string,
  filename = "flowpanel.config.ts",
  appDir = "app",
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
      `eject: dashboard with path "${dashboardPath}" not found in flowpanel.config.ts`,
    );
  }

  const slug = dashboardPath === "/" ? "" : dashboardPath;
  const trimmed = commentOutAll(source, matches).replace(/\s+$/, "");
  return `${trimmed}\n\n// ejected: ${appDir}/admin${slug}\n`;
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
    return `${source.slice(0, call.getStart())}undefined${source.slice(call.getEnd())}`;
  }

  const { start, end } = spanOf(source, call);
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const indent = source.slice(lineStart, start);
  let lineEnd = end;
  while (/[ \t]/.test(source[lineEnd] ?? "")) lineEnd++;
  const endsTheLine =
    lineEnd >= source.length || source[lineEnd] === "\n" || source[lineEnd] === "\r";

  // Line comments only work when the entry owns its lines start to finish;
  // an entry sharing a line with other code gets a block comment instead.
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
