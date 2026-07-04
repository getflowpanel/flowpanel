import { Node, Project } from "ts-morph";

/** Indentation of the line `pos` sits on. */
function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf("\n", pos - 1) + 1;
  const match = /^[ \t]*/.exec(source.slice(lineStart, pos));
  return match?.[0] ?? "";
}

/**
 * Splices `callText` into the `resources` array as source text.
 *
 * ts-morph's `addElement` reprints the array, which drops the comments the init
 * scaffold leaves there as a worked example — and any the user wrote themselves.
 */
function spliceIntoArray(
  source: string,
  range: { start: number; end: number; elements: number[] },
  callText: string,
): string {
  const last = range.elements.at(-1);
  if (last !== undefined) {
    const indent = lineIndent(source, last);
    return `${source.slice(0, last)},\n${indent}${callText}${source.slice(last)}`;
  }
  const closeBracket = range.end - 1;
  const closeIndent = lineIndent(source, closeBracket);
  let trimmed = closeBracket;
  while (trimmed > range.start && /\s/.test(source[trimmed - 1] ?? "")) trimmed--;
  return `${source.slice(0, trimmed)}\n${closeIndent}  ${callText},\n${closeIndent}${source.slice(
    closeBracket,
  )}`;
}

/** Insert a `resource(...)` call into the `resources` array of a flowpanel.config.ts source string. */
export function editConfigToAddResource(
  source: string,
  resourceName: string,
  options?: { table?: string; kind?: "drizzle" | "prisma"; filename?: string },
): string {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, jsx: 4 /* Preserve */ },
  });
  const sf = project.createSourceFile(options?.filename ?? "flowpanel.config.ts", source);

  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const calleeText = node.getExpression().getText().trim();
    if (calleeText !== "resource") return;
    const args = node.getArguments();
    const first = args[0];
    if (!first) return;
    const text = first.getText().trim();

    const dotMatch = /\.([A-Za-z_][\w$]*)\s*$/.exec(text);
    if (dotMatch && dotMatch[1] === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
    if (text === resourceName) {
      throw new Error(`new: resource "${resourceName}" already exists in flowpanel.config.ts`);
    }
  });

  const kind = options?.kind ?? "drizzle";
  let firstArg: string;
  if (options?.table) {
    firstArg = options.table;
  } else if (kind === "prisma") {
    firstArg = `"${resourceName}"`;
  } else {
    firstArg = `schema.${resourceName}`;
  }
  const typeParam = kind === "prisma" ? "<unknown>" : "";
  const callText = `resource${typeParam}(${firstArg}, { columns: ["id"] })`;

  let arrayRange: { start: number; end: number; elements: number[] } | null = null;
  let objectEnd: number | null = null;

  sf.forEachDescendant((node) => {
    if (arrayRange || objectEnd !== null) return;
    if (!Node.isCallExpression(node)) return;
    if (node.getExpression().getText().trim() !== "defineAdmin") return;
    const first = node.getArguments()[0];
    if (!first || !Node.isObjectLiteralExpression(first)) return;

    const resourcesProp = first.getProperty("resources");
    if (resourcesProp && Node.isPropertyAssignment(resourcesProp)) {
      const init = resourcesProp.getInitializer();
      if (init && Node.isArrayLiteralExpression(init)) {
        arrayRange = {
          start: init.getStart(),
          end: init.getEnd(),
          elements: init.getElements().map((e) => e.getEnd()),
        };
        return;
      }
    }
    objectEnd = first.getEnd();
  });

  if (arrayRange) {
    return spliceIntoArray(source, arrayRange, callText);
  }

  if (objectEnd !== null) {
    const closeBrace = (objectEnd as number) - 1;
    const closeIndent = lineIndent(source, closeBrace);
    let trimmed = closeBrace;
    while (trimmed > 0 && /\s/.test(source[trimmed - 1] ?? "")) trimmed--;
    const separator = source[trimmed - 1] === "," ? "" : ",";
    return `${source.slice(0, trimmed)}${separator}\n${closeIndent}  resources: [\n${closeIndent}    ${callText},\n${closeIndent}  ],\n${closeIndent}${source.slice(closeBrace)}`;
  }

  throw new Error("new: could not find a defineAdmin({ ... }) call in flowpanel.config.ts");
}
