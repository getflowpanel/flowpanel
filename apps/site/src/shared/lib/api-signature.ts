import { resolve } from "node:path";
import { type Symbol as MorphSymbol, Node, type Project, ts } from "ts-morph";
import { getTypeProject } from "./type-project";

export interface ApiSymbolDoc {
  name: string;
  kind: "function" | "const" | "class";
  signatures: readonly string[];
  description: string;
  deprecated: string | null;
  sourcePath: string;
}

interface ExtractApiSymbolOptions {
  path: string;
  name: string;
  project?: Project;
}

function actualSymbol(symbol: MorphSymbol): MorphSymbol {
  return symbol.getAliasedSymbol() ?? symbol;
}

function jsDoc(declarations: readonly Node[]): Pick<ApiSymbolDoc, "description" | "deprecated"> {
  for (const declaration of declarations) {
    if (!("getJsDocs" in declaration)) continue;
    const docs = (declaration as Node & { getJsDocs(): import("ts-morph").JSDoc[] }).getJsDocs();
    if (docs.length === 0) continue;
    const doc = docs[0];
    if (!doc) continue;
    const deprecated = doc.getTags().find((tag) => tag.getTagName() === "deprecated");
    return {
      description: doc.getDescription().trim(),
      deprecated: deprecated?.getCommentText()?.trim() || (deprecated ? "Deprecated." : null),
    };
  }
  return { description: "", deprecated: null };
}

function normalizeSignature(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function functionSignatures(
  project: Project,
  symbol: MorphSymbol,
  declaration: Node,
  publicName: string,
): string[] {
  const checker = project.getTypeChecker();
  const type = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  const signatures = type.getCallSignatures();
  return signatures.map((signature) => {
    const text = checker.compilerObject.signatureToString(
      signature.compilerSignature,
      declaration.compilerNode,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
    );
    return normalizeSignature(`export function ${publicName}${text};`);
  });
}

function constSignature(
  project: Project,
  symbol: MorphSymbol,
  declaration: Node,
  publicName: string,
): string {
  const type = project.getTypeChecker().getTypeOfSymbolAtLocation(symbol, declaration);
  const text = project
    .getTypeChecker()
    .getTypeText(type, declaration, ts.TypeFormatFlags.NoTruncation);
  return normalizeSignature(`export const ${publicName}: ${text};`);
}

function classSignature(
  declaration: import("ts-morph").ClassDeclaration,
  publicName: string,
): string {
  const typeParameters = declaration.getTypeParameters();
  const generic =
    typeParameters.length > 0
      ? `<${typeParameters.map((parameter) => parameter.getText()).join(", ")}>`
      : "";
  const constructors = declaration.getConstructors();
  const bodies = constructors.map((constructorDeclaration) => {
    const parameters = constructorDeclaration.getParameters().map((parameter) => {
      const optional = parameter.isOptional() ? "?" : "";
      const type = parameter.getTypeNode()?.getText() ?? parameter.getType().getText(parameter);
      return `${parameter.getName()}${optional}: ${type}`;
    });
    return `constructor(${parameters.join(", ")});`;
  });
  return normalizeSignature(
    `export class ${publicName}${generic}${bodies.length > 0 ? ` { ${bodies.join(" ")} }` : " {}"}`,
  );
}

export function extractApiSymbol({
  path,
  name,
  project = getTypeProject(),
}: ExtractApiSymbolOptions): ApiSymbolDoc {
  const absolutePath = path.startsWith("/") ? path : resolve(process.cwd(), path);
  const sourceFile =
    project.getSourceFile(path) ??
    project.getSourceFile(absolutePath) ??
    (() => {
      try {
        return project.addSourceFileAtPath(absolutePath);
      } catch {
        return undefined;
      }
    })();
  const exported = sourceFile?.getExportSymbols().find((symbol) => symbol.getName() === name);
  if (!sourceFile || !exported) {
    throw new Error(
      `Cannot generate API signature for ${name} from ${path}: exported symbol not found.`,
    );
  }

  const resolved = actualSymbol(exported);
  const declarations = resolved.getDeclarations();
  const declaration = declarations[0] ?? exported.getDeclarations()[0];
  if (!declaration) {
    throw new Error(
      `Cannot generate API signature for ${name} from ${path}: declaration not found.`,
    );
  }

  let kind: ApiSymbolDoc["kind"];
  let signatures: readonly string[];
  if (Node.isFunctionDeclaration(declaration)) {
    kind = "function";
    signatures = functionSignatures(project, resolved, declaration, name);
  } else if (Node.isVariableDeclaration(declaration)) {
    kind = "const";
    signatures = [constSignature(project, resolved, declaration, name)];
  } else if (Node.isClassDeclaration(declaration)) {
    kind = "class";
    signatures = [classSignature(declaration, name)];
  } else {
    throw new Error(
      `Cannot generate API signature for ${name} from ${path}: ${declaration.getKindName()} is not a supported callable, constant, or class.`,
    );
  }

  return {
    name,
    kind,
    signatures,
    ...jsDoc(declarations),
    sourcePath: path,
  };
}
