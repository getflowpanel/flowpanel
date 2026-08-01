import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_INDEX = path.join(HERE, "../../../core/src/index.ts");
const KIT_INDEX = path.join(HERE, "../index.ts");

/** Names an entry barrel exposes: `export { a, type B } from …` plus local `export`ed declarations. */
function exportedNames(file: string): Set<string> {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names = new Set<string>();
  for (const stmt of source.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const clause = stmt.exportClause;
      if (clause && ts.isNamedExports(clause)) {
        for (const spec of clause.elements) names.add(spec.name.text);
      }
      continue;
    }
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (
      ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt) ||
      ts.isEnumDeclaration(stmt)
    ) {
      if (stmt.name) names.add(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
      }
    }
  }
  return names;
}

describe("@flowpanel/kit re-exports all of @flowpanel/core", () => {
  const core = exportedNames(CORE_INDEX);
  const kit = exportedNames(KIT_INDEX);

  it("parses both barrels", () => {
    expect(core.size).toBeGreaterThan(100);
    expect(kit.size).toBeGreaterThan(100);
  });

  it("has no core symbol the umbrella omits", () => {
    // `@flowpanel/core` is a transitive dependency of the kit, so under pnpm it
    // is not resolvable from a consumer app: anything core exports but the kit
    // does not re-export has no reachable import path at all.
    const missing = [...core].filter((name) => !kit.has(name)).sort();
    expect(missing).toEqual([]);
  });
});
