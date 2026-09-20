import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type InterfaceDeclaration,
  type MethodSignature,
  Project,
  type PropertySignature,
  SyntaxKind,
  type TypeAliasDeclaration,
} from "ts-morph";

export function createTypeProject(root: string): Project {
  return new Project({
    ...(existsSync(join(root, "tsconfig.base.json"))
      ? { tsConfigFilePath: join(root, "tsconfig.base.json") }
      : {}),
    skipAddingFilesFromTsConfig: true,
  });
}

function cell(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

function describe(member: PropertySignature | MethodSignature): string {
  const docs = member.getJsDocs();
  const summary = cell(docs.map((doc) => doc.getCommentText() ?? "").join(" "));
  const defaultValue = docs
    .flatMap((doc) => doc.getTags())
    .find((tag) => tag.getTagName() === "defaultValue")
    ?.getCommentText()
    ?.trim();
  return [summary, defaultValue ? `Default: \`${cell(defaultValue)}\`.` : ""]
    .filter(Boolean)
    .join(" ");
}

function inheritedRows(declaration: InterfaceDeclaration): (PropertySignature | MethodSignature)[] {
  return declaration
    .getType()
    .getProperties()
    .flatMap((property) => property.getDeclarations())
    .filter(
      (node): node is PropertySignature | MethodSignature =>
        node.isKind(SyntaxKind.PropertySignature) || node.isKind(SyntaxKind.MethodSignature),
    );
}

function memberRows(
  declaration: InterfaceDeclaration | TypeAliasDeclaration,
): (PropertySignature | MethodSignature)[] {
  if (declaration.isKind(SyntaxKind.InterfaceDeclaration)) {
    const own = declaration
      .getMembers()
      .filter(
        (member): member is PropertySignature | MethodSignature =>
          member.isKind(SyntaxKind.PropertySignature) || member.isKind(SyntaxKind.MethodSignature),
      );
    return own.length > 0 ? own : inheritedRows(declaration);
  }
  return [
    ...declaration.getDescendantsOfKind(SyntaxKind.PropertySignature),
    ...declaration.getDescendantsOfKind(SyntaxKind.MethodSignature),
  ];
}

function signatureOf(member: PropertySignature | MethodSignature): string {
  if (member.isKind(SyntaxKind.MethodSignature)) {
    const parameters = member.getParameters().map((parameter) => parameter.getText());
    return `(${parameters.join(", ")}) => ${member.getReturnTypeNode()?.getText() ?? "unknown"}`;
  }
  return member.getTypeNode()?.getText() ?? member.getType().getText(member);
}

export function renderTypeTable(
  project: Project,
  siteRoot: string,
  path: string,
  name: string,
): string {
  const file = resolve(siteRoot, path);
  if (!existsSync(file)) return "";
  const source = project.getSourceFile(file) ?? project.addSourceFileAtPath(file);
  const declaration: InterfaceDeclaration | TypeAliasDeclaration | undefined =
    source.getInterface(name) ?? source.getTypeAlias(name);
  if (!declaration) return "";
  const rows = memberRows(declaration);
  if (rows.length === 0) {
    return declaration.isKind(SyntaxKind.TypeAliasDeclaration)
      ? `\`${name}\` is \`${cell(declaration.getTypeNodeOrThrow().getText())}\`.`
      : "";
  }
  const lines = [`\`${name}\``, "", "| Property | Type | Notes |", "| --- | --- | --- |"];
  for (const member of rows) {
    const optional = member.hasQuestionToken() ? "?" : "";
    lines.push(
      `| \`${member.getName()}${optional}\` | \`${cell(signatureOf(member))}\` | ${describe(member)} |`,
    );
  }
  return lines.join("\n");
}
