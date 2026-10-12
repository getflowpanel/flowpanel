import { Node, Project, type SourceFile } from "ts-morph";
import { configProblem } from "../utils/config-problem";

/** A single text insertion, expressed against the original source offsets. */
interface Insertion {
  pos: number;
  text: string;
}

/**
 * Where to splice `resource` into the import that already brings in `defineAdmin`,
 * or `null` when the name is imported already (or there is no such import to join).
 */
function resourceImportInsertion(sf: SourceFile): Insertion | null {
  const imports = sf.getImportDeclarations();
  for (const decl of imports) {
    const bound = [
      ...decl.getNamedImports().map((n) => (n.getAliasNode() ?? n.getNameNode()).getText()),
      decl.getDefaultImport()?.getText(),
      decl.getNamespaceImport()?.getText(),
    ];
    if (bound.includes("resource")) return null;
  }

  const host = imports.find((d) =>
    d.getNamedImports().some((n) => n.getNameNode().getText() === "defineAdmin"),
  );
  if (!host) return null;

  const named = host.getNamedImports();
  const after = named.find((n) => n.getNameNode().getText() > "resource");
  if (after) return { pos: after.getStart(), text: "resource, " };
  const last = named.at(-1);
  return last ? { pos: last.getEnd(), text: ", resource" } : null;
}

function applyInsertion(source: string, insertion: Insertion | null): string {
  if (!insertion) return source;
  return `${source.slice(0, insertion.pos)}${insertion.text}${source.slice(insertion.pos)}`;
}

/** The module specifier that binds `identifier`, when it names one import wholesale. */
function importSpecifierFor(sf: SourceFile, identifier: string): string | null {
  for (const decl of sf.getImportDeclarations()) {
    const bound = [
      ...decl.getNamedImports().map((n) => (n.getAliasNode() ?? n.getNameNode()).getText()),
      decl.getDefaultImport()?.getText(),
      decl.getNamespaceImport()?.getText(),
    ];
    if (bound.includes(identifier)) return decl.getModuleSpecifierValue();
  }
  return null;
}

const SCAFFOLD_HINTS =
  /^[ \t]*\/\/ (?:Add `resource` to the "@flowpanel\/kit" import above, then:|(?:pnpm|npx|yarn|bunx) flowpanel new <(?:table|model)> {2}adds an entry;[^\r\n]*)[ \t]*\r?\n/m;

/** Indentation of the line `pos` sits on. */
export function lineIndent(source: string, pos: number): string {
  const lineStart = source.lastIndexOf("\n", pos - 1) + 1;
  const match = /^[ \t]*/.exec(source.slice(lineStart, pos));
  return match?.[0] ?? "";
}

/** Splices `callText` into the `resources` array as source text, since `addElement` would drop existing comments. */
export function spliceIntoArray(
  source: string,
  range: { start: number; end: number; elements: number[] },
  callText: string,
): string {
  const last = range.elements.at(-1);
  if (last !== undefined) {
    const indent = lineIndent(source, last);
    const entry = callText.split("\n").join(`\n${indent}`);
    const lineEnd = source.indexOf("\n", last);
    const trailing =
      lineEnd === -1 ? null : /^\s*(,?)(\s*\/\/.*)$/.exec(source.slice(last, lineEnd));
    if (trailing) {
      const [, comma = "", comment = ""] = trailing;
      return `${source.slice(0, last)},${comment}\n${indent}${entry}${comma}${source.slice(lineEnd)}`;
    }
    return `${source.slice(0, last)},\n${indent}${entry}${source.slice(last)}`;
  }
  const closeBracket = range.end - 1;
  const closeIndent = lineIndent(source, closeBracket);
  const entry = callText.split("\n").join(`\n${closeIndent}  `);
  let trimmed = closeBracket;
  while (trimmed > range.start && /\s/.test(source[trimmed - 1] ?? "")) trimmed--;
  return `${source.slice(0, trimmed)}\n${closeIndent}  ${entry},\n${closeIndent}${source.slice(
    closeBracket,
  )}`;
}

function duplicate(resourceName: string, filename = "flowpanel.config.ts"): string {
  return configProblem("resources", `${filename} already has a resource "${resourceName}".`);
}

/** Insert a `resource(...)` call into the `resources` array of a flowpanel.config.ts source string. */
export function editConfigToAddResource(
  source: string,
  resourceName: string,
  options?: {
    table?: string;
    kind?: "drizzle" | "prisma";
    filename?: string;
    /** The whole `resource(...)` call to insert; defaults to one with empty options. */
    entry?: string;
    hidden?: boolean;
  },
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
      throw new Error(duplicate(resourceName, options?.filename));
    }
    const stringMatch = /^["'`]([\w-]+)["'`]$/.exec(text);
    if (stringMatch && stringMatch[1] === resourceName) {
      throw new Error(duplicate(resourceName, options?.filename));
    }
    if (text === resourceName) {
      throw new Error(duplicate(resourceName, options?.filename));
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
  const callText =
    options?.entry ?? `resource(${firstArg}, ${options?.hidden ? "{ hidden: true }" : "{}"})`;
  const importInsertion = resourceImportInsertion(sf);

  let arrayRange: { start: number; end: number; elements: number[] } | null = null;
  let objectEnd: number | null = null;
  let elsewhere: string | null = null;

  sf.forEachDescendant((node) => {
    if (arrayRange || objectEnd !== null || elsewhere !== null) return;
    if (!Node.isCallExpression(node)) return;
    if (node.getExpression().getText().trim() !== "defineAdmin") return;
    const first = node.getArguments()[0];
    if (!first || !Node.isObjectLiteralExpression(first)) return;

    const resourcesProp = first.getProperty("resources");
    if (resourcesProp && Node.isShorthandPropertyAssignment(resourcesProp)) {
      elsewhere = "resources";
      return;
    }
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
      if (init) {
        elsewhere = init.getText();
        return;
      }
    }
    objectEnd = first.getEnd();
  });

  if (elsewhere !== null) {
    const file = options?.filename ?? "flowpanel.config.ts";
    const from = importSpecifierFor(sf, elsewhere);
    const dir = from ?? "that directory";
    throw new Error(
      configProblem(
        "resources",
        `${file} takes them from \`${elsewhere}\`${from ? ` (imported from "${from}")` : ""}, not an array literal. ` +
          `Write the resource into ${dir} with --dir ${from ?? "<dir>"}.`,
      ),
    );
  }

  if (arrayRange) {
    return applyInsertion(spliceIntoArray(source, arrayRange, callText), importInsertion).replace(
      SCAFFOLD_HINTS,
      "",
    );
  }

  if (objectEnd !== null) {
    const closeBrace = (objectEnd as number) - 1;
    const closeIndent = lineIndent(source, closeBrace);
    let trimmed = closeBrace;
    while (trimmed > 0 && /\s/.test(source[trimmed - 1] ?? "")) trimmed--;
    const separator = source[trimmed - 1] === "," ? "" : ",";
    return applyInsertion(
      `${source.slice(0, trimmed)}${separator}\n${closeIndent}  resources: [\n${closeIndent}    ${callText.split("\n").join(`\n${closeIndent}    `)},\n${closeIndent}  ],\n${closeIndent}${source.slice(closeBrace)}`,
      importInsertion,
    ).replace(SCAFFOLD_HINTS, "");
  }

  throw new Error(
    configProblem(
      options?.filename ?? "flowpanel.config.ts",
      "no defineAdmin({ ... }) call to add the resource to. Add it to resources by hand.",
    ),
  );
}
