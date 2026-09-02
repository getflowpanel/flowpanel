import * as path from "node:path";
import { Node, Project, type SourceFile, SyntaxKind } from "ts-morph";
import { fileExists } from "../utils/detect";

const ADMIN_CSS_IMPORT_RE = /["']@\/styles\/admin\.css["']|["']\.{1,2}\/.*styles\/admin\.css["']/;

export async function findAppLayout(cwd: string): Promise<string | null> {
  for (const relativePath of ["app/layout.tsx", "src/app/layout.tsx"]) {
    if (await fileExists(path.join(cwd, relativePath))) return relativePath;
  }
  return null;
}

export function hasAdminCssImport(source: string): boolean {
  return ADMIN_CSS_IMPORT_RE.test(source);
}

function skipLeadingTrivia(source: string, start: number): number {
  let cursor = start;
  while (cursor < source.length) {
    const rest = source.slice(cursor);
    const whitespace = /^\s+/.exec(rest)?.[0];
    if (whitespace) {
      cursor += whitespace.length;
      continue;
    }
    const lineComment = /^\/\/[^\n]*(?:\n|$)/.exec(rest)?.[0];
    if (lineComment) {
      cursor += lineComment.length;
      continue;
    }
    const blockComment = /^\/\*[\s\S]*?\*\//.exec(rest)?.[0];
    if (blockComment) {
      cursor += blockComment.length;
      continue;
    }
    break;
  }
  return cursor;
}

function insertImportAfterDirectives(source: string, line: string): string {
  let cursor = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  cursor = skipLeadingTrivia(source, cursor);
  while (cursor < source.length) {
    const directive = /^(["'])use [^"'\r\n]+\1[ \t]*;?/.exec(source.slice(cursor))?.[0];
    if (!directive) break;
    cursor = skipLeadingTrivia(source, cursor + directive.length);
  }
  return `${source.slice(0, cursor)}${line}${source.slice(cursor)}`;
}

export function patchLayoutWithCssImport(source: string, importSpec: string): string | null {
  if (hasAdminCssImport(source)) return null;
  if (/import\s+["'][^"']+\.css["']/.test(source)) return null;
  return insertImportAfterDirectives(source, `import "${importSpec}";\n`);
}

export function patchLayoutWithSuppressHydration(source: string): string | null {
  const sourceFile = parseLayout(source, true);
  if (!sourceFile) return null;
  const html = sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
    .find((element) => element.getTagNameNode().getText() === "html");
  if (!html) return null;
  if (
    html
      .getAttributes()
      .some(
        (attribute) =>
          Node.isJsxAttribute(attribute) &&
          attribute.getNameNode().getText() === "suppressHydrationWarning",
      )
  ) {
    return null;
  }

  const close = html.getEnd() - 1;
  let insertAt = close;
  while (insertAt > html.getStart() && /\s/.test(source[insertAt - 1] ?? "")) insertAt--;
  return `${source.slice(0, insertAt)} suppressHydrationWarning${source.slice(insertAt)}`;
}

function indentAt(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return /^\s*/.exec(source.slice(lineStart, index))?.[0] ?? "";
}

function parseLayout(source: string, allowIncomplete = false): SourceFile | null {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("layout.tsx", source);
  if (!allowIncomplete && project.getProgram().getSyntacticDiagnostics(sourceFile).length > 0) {
    return null;
  }
  return sourceFile;
}

function themeScriptBinding(sourceFile: SourceFile): { jsx: string; importLine?: string } {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "@flowpanel/kit/react") continue;
    const named = declaration
      .getNamedImports()
      .find(
        (specifier) =>
          specifier.getName() === "ThemeScript" &&
          !declaration.isTypeOnly() &&
          !specifier.isTypeOnly(),
      );
    if (named) return { jsx: named.getAliasNode()?.getText() ?? "ThemeScript" };
    const namespace = declaration.getNamespaceImport();
    if (namespace && !declaration.isTypeOnly()) {
      return { jsx: `${namespace.getText()}.ThemeScript` };
    }
  }

  const used = new Set(
    sourceFile
      .getDescendantsOfKind(SyntaxKind.Identifier)
      .map((identifier) => identifier.getText()),
  );
  let local = "ThemeScript";
  if (used.has(local)) {
    local = "FlowPanelThemeScript";
    let suffix = 2;
    while (used.has(local)) local = `FlowPanelThemeScript${suffix++}`;
  }
  return {
    jsx: local,
    importLine:
      local === "ThemeScript"
        ? 'import { ThemeScript } from "@flowpanel/kit/react";\n'
        : `import { ThemeScript as ${local} } from "@flowpanel/kit/react";\n`,
  };
}

function hasJsxElement(sourceFile: SourceFile, name: string): boolean {
  return (
    sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
      .some((element) => element.getTagNameNode().getText() === name) ||
    sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
      .some((element) => element.getTagNameNode().getText() === name)
  );
}

export function patchLayoutWithThemeScript(source: string): string | null {
  const sourceFile = parseLayout(source);
  if (!sourceFile) return null;
  const binding = themeScriptBinding(sourceFile);
  if (hasJsxElement(sourceFile, binding.jsx)) return null;

  const htmlOpening = sourceFile
    .getDescendantsOfKind(SyntaxKind.JsxOpeningElement)
    .find((element) => element.getTagNameNode().getText() === "html");
  const html = htmlOpening?.getParent();
  if (!htmlOpening || !html || !Node.isJsxElement(html)) return null;

  const head = html.getJsxChildren().find((child) => {
    if (Node.isJsxElement(child))
      return child.getOpeningElement().getTagNameNode().getText() === "head";
    return Node.isJsxSelfClosingElement(child) && child.getTagNameNode().getText() === "head";
  });

  let next: string;
  if (head && Node.isJsxElement(head)) {
    const opening = head.getOpeningElement();
    const indent = indentAt(source, opening.getStart());
    const at = opening.getEnd();
    next = `${source.slice(0, at)}\n${indent}  <${binding.jsx} defaultMode="auto" />${source.slice(at)}`;
  } else if (head && Node.isJsxSelfClosingElement(head)) {
    const indent = indentAt(source, head.getStart());
    next = `${source.slice(0, head.getStart())}<head>\n${indent}  <${binding.jsx} defaultMode="auto" />\n${indent}</head>${source.slice(head.getEnd())}`;
  } else {
    const indent = indentAt(source, htmlOpening.getStart());
    const at = htmlOpening.getEnd();
    next = `${source.slice(0, at)}\n${indent}  <head>\n${indent}    <${binding.jsx} defaultMode="auto" />\n${indent}  </head>${source.slice(at)}`;
  }
  return binding.importLine ? insertImportAfterDirectives(next, binding.importLine) : next;
}
