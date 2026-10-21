import * as path from "node:path";
import { type ArrayLiteralExpression, Node, Project, type SourceFile, SyntaxKind } from "ts-morph";
import { lineIndent } from "../eject/add-resource";
import { aliasOf, detectPathAlias } from "../utils/detect";
import { prismaClientModuleFor } from "../utils/prisma-provider";

function parse(source: string): SourceFile {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile("config.ts", source);
}

function insertLineBefore(source: string, closeBrace: number, line: string): string {
  let at = closeBrace;
  while (at > 0 && /[ \t]/.test(source[at - 1] ?? "")) at--;
  return `${source.slice(0, at)}${line}\n${source.slice(at)}`;
}

/**
 * Registers a Prisma model's row under its resource name in the config's `FlowpanelResources`,
 * so its columns, filters, reads and the references to it are typed. Unchanged when the config has no `declare module "@flowpanel/kit"` block.
 */
export function addPrismaResourceType(
  source: string,
  name: string,
  model: string,
  clientModule = "@prisma/client",
): string {
  const block = parse(source)
    .getModules()
    .find((module) => module.getName().replace(/^["']|["']$/g, "") === "@flowpanel/kit");
  const body = block?.getBody();
  if (!block || !body || !Node.isModuleBlock(body)) return source;
  const entry = `${/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name)}: import(${JSON.stringify(clientModule)}).${model};`;
  const registry = body.getInterface("FlowpanelResources");
  if (registry) {
    if (registry.getProperty(name) || registry.getProperty(JSON.stringify(name))) return source;
    const indent = `${lineIndent(source, registry.getStart())}  `;
    return insertLineBefore(source, registry.getEnd() - 1, `${indent}${entry}`);
  }
  const indent = `${lineIndent(source, block.getStart())}  `;
  return insertLineBefore(
    source,
    block.getEnd() - 1,
    `${indent}interface FlowpanelResources {\n${indent}  ${entry}\n${indent}}`,
  );
}

/** `addPrismaResourceType` with the model types read from where `file` imports the Prisma client; no name, no change. */
export async function typePrismaModel(
  cwd: string,
  file: string,
  source: string,
  name: string | null | undefined,
  model: string,
): Promise<string> {
  if (!name) return source;
  return addPrismaResourceType(source, name, model, await prismaClientModuleFor(cwd, file));
}

export type WireResult =
  | { kind: "wired"; source: string }
  | { kind: "already" }
  | { kind: "manual"; line: string };

function resourcesArray(sf: SourceFile): ArrayLiteralExpression | null {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== "defineAdmin") continue;
    const options = call.getArguments()[0];
    if (!options || !Node.isObjectLiteralExpression(options)) continue;
    const prop = options.getProperty("resources");
    const init = prop && Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;
    if (init && Node.isArrayLiteralExpression(init)) return init;
  }
  return null;
}

/**
 * Makes a config read the `resources` a `new --dir` directory exports: an import and a spread
 * into its `resources` array. `manual` carries the change to make by hand when the config is
 * not shaped for an automatic edit.
 */
export function wireResourcesDir(
  source: string,
  specifier: string,
  importsDir: (specifier: string) => boolean,
): WireResult {
  const sf = parse(source);
  const imports = sf.getImportDeclarations();
  if (imports.some((declaration) => importsDir(declaration.getModuleSpecifierValue()))) {
    return { kind: "already" };
  }
  const importLine = `import { resources } from "${specifier}";`;
  const manual: WireResult = {
    kind: "manual",
    line: `${importLine} and add ...resources to the resources array`,
  };
  const taken = imports.some((declaration) =>
    declaration
      .getNamedImports()
      .some((named) => (named.getAliasNode() ?? named.getNameNode()).getText() === "resources"),
  );
  const array = resourcesArray(sf);
  if (taken || !array) return manual;

  const last = array.getElements().at(-1);
  let edited: string;
  if (last) {
    const multiline = array.getText().includes("\n");
    const separator = multiline ? `,\n${lineIndent(source, last.getStart())}` : ", ";
    edited = `${source.slice(0, last.getEnd())}${separator}...resources${source.slice(last.getEnd())}`;
  } else {
    edited = `${source.slice(0, array.getStart())}[...resources]${source.slice(array.getEnd())}`;
  }
  const lastImport = imports.at(-1);
  if (!lastImport) return { kind: "wired", source: `${importLine}\n${edited}` };
  const at = lastImport.getEnd();
  return { kind: "wired", source: `${edited.slice(0, at)}\n${importLine}${edited.slice(at)}` };
}

/** How the config imports `absoluteDir`: through `@/*` when tsconfig maps it, else relative to the config file. */
export async function dirSpecifier(
  cwd: string,
  configFile: string,
  absoluteDir: string,
): Promise<string> {
  const relative = path.relative(cwd, absoluteDir).split(path.sep).join("/");
  const aliasMode = await detectPathAlias(cwd);
  if (aliasMode === "root" || (aliasMode === "strip-src" && relative.startsWith("src/"))) {
    return aliasOf(relative, aliasMode);
  }
  const fromConfig = path.relative(path.dirname(configFile), absoluteDir).split(path.sep).join("/");
  return fromConfig.startsWith(".") ? fromConfig : `./${fromConfig}`;
}
