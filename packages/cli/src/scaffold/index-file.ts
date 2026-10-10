import { type ArrayLiteralExpression, Node, Project, type SourceFile } from "ts-morph";
import { spliceIntoArray } from "../eject/add-resource";

function parse(source: string): SourceFile {
  return new Project({ useInMemoryFileSystem: true }).createSourceFile("index.ts", source);
}

function exportedArray(file: SourceFile): ArrayLiteralExpression | null {
  for (const statement of file.getVariableStatements()) {
    if (!statement.isExported()) continue;
    for (const declaration of statement.getDeclarations()) {
      let value = declaration.getInitializer();
      while (value && (Node.isAsExpression(value) || Node.isSatisfiesExpression(value))) {
        value = value.getExpression();
      }
      if (value && Node.isArrayLiteralExpression(value)) return value;
    }
  }
  return null;
}

/** `<dir>/index.ts` with the resource imported and appended to its exported array; unchanged if already there. */
export function appendToIndex(source: string | null, exportName: string, fileBase: string): string {
  const importLine = `import { ${exportName} } from "./${fileBase}";`;
  if (source === null)
    return `${importLine}\n\nexport const resources = [${exportName}] as const;\n`;
  const file = parse(source);
  const imported = file
    .getImportDeclarations()
    .some((declaration) =>
      declaration.getNamedImports().some((named) => named.getName() === exportName),
    );
  if (imported) return source;
  const array = exportedArray(file);
  if (!array)
    throw new Error(`index.ts exports no array to add "${exportName}" to. Add it by hand.`);
  const last = array.getElements().at(-1);
  const withEntry =
    last && !array.getText().includes("\n")
      ? `${source.slice(0, last.getEnd())}, ${exportName}${source.slice(last.getEnd())}`
      : spliceIntoArray(
          source,
          {
            start: array.getStart(),
            end: array.getEnd(),
            elements: array.getElements().map((e) => e.getEnd()),
          },
          exportName,
        );
  const lastImport = file.getImportDeclarations().at(-1);
  if (!lastImport) return `${importLine}\n\n${withEntry}`;
  const at = lastImport.getEnd();
  return `${withEntry.slice(0, at)}\n${importLine}${withEntry.slice(at)}`;
}
