import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORE_INDEX = path.join(HERE, "../../../core/src/index.ts");
const CORE_INTERNAL = path.join(HERE, "../../../core/src/internal/index.ts");
const KIT_INDEX = path.join(HERE, "../index.ts");
const KIT_PUBLISH = path.join(HERE, "../publish.ts");
const KIT_PACKAGE_JSON = path.join(HERE, "../../package.json");

/** Names an entry barrel exposes, including the kit's canonical core star re-export. */
function exportedNames(file: string, visited = new Set<string>()): Set<string> {
  if (visited.has(file)) return new Set();
  visited.add(file);
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
      } else if (
        stmt.moduleSpecifier &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text === "@flowpanel/core"
      ) {
        for (const name of exportedNames(CORE_INDEX, visited)) names.add(name);
      } else if (
        stmt.moduleSpecifier &&
        ts.isStringLiteral(stmt.moduleSpecifier) &&
        stmt.moduleSpecifier.text.startsWith("./")
      ) {
        const base = path.join(path.dirname(file), stmt.moduleSpecifier.text);
        const target = existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, "index.ts");
        for (const name of exportedNames(target, visited)) names.add(name);
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
    // `@flowpanel/core` ships inside the kit and is not published: anything core
    // exports but the kit root does not re-export has no import path at all.
    const missing = [...core].filter((name) => !kit.has(name)).sort();
    expect(missing).toEqual([]);
  });
});

describe("@flowpanel/core keeps its plumbing off the root the kit re-exports", () => {
  it("exports no name from both the root and @flowpanel/core/internal", () => {
    const internal = exportedNames(CORE_INTERNAL);
    expect(internal.size).toBeGreaterThan(20);
    const root = exportedNames(CORE_INDEX);
    expect([...internal].filter((name) => root.has(name)).sort()).toEqual([]);
  });

  it("serves the runtime-only helpers from internal, not the root", () => {
    const root = exportedNames(CORE_INDEX);
    const internal = exportedNames(CORE_INTERNAL);
    for (const name of [
      "assertCountWhereColumns",
      "declaredWriteFields",
      "emitAudit",
      "isBuiltinBulkDelete",
    ]) {
      expect(root.has(name), name).toBe(false);
      expect(internal.has(name), name).toBe(true);
    }
  });
});

describe("@flowpanel/kit exposes a ./publish subpath re-exporting @flowpanel/core/publish", () => {
  it("src/publish.ts re-exports @flowpanel/core/publish", () => {
    const source = readFileSync(KIT_PUBLISH, "utf8");
    expect(source).toContain('export * from "@flowpanel/core/publish"');
  });

  it("package.json wires ./publish to dist/publish, and require to core's CommonJS build", () => {
    const pkg = JSON.parse(readFileSync(KIT_PACKAGE_JSON, "utf8")) as {
      exports: Record<string, unknown>;
    };
    expect(pkg.exports["./publish"]).toEqual({
      import: { types: "./dist/publish.d.ts", default: "./dist/publish.js" },
      require: { types: "./dist/core/publish.d.cts", default: "./dist/core/publish.cjs" },
    });
  });

  it("re-exports the same symbols @flowpanel/core/publish declares", async () => {
    const [kit, core] = await Promise.all([
      import("../publish"),
      import("@flowpanel/core/publish"),
    ]);
    expect(Object.keys(kit).sort()).toEqual(Object.keys(core).sort());
  });
});

describe("@flowpanel/kit keeps one subpath per job", () => {
  const pkg = JSON.parse(readFileSync(KIT_PACKAGE_JSON, "utf8")) as {
    exports: Record<string, unknown>;
  };

  it("exposes exactly the documented subpaths", () => {
    expect(Object.keys(pkg.exports).sort()).toEqual(
      [
        ".",
        "./auth",
        "./bullmq",
        "./bullmq/board",
        "./charts",
        "./client",
        "./drizzle",
        "./next",
        "./package.json",
        "./prisma",
        "./publish",
        "./react",
        "./styles/admin.css",
        "./styles/tailwind.css",
        "./test",
        "./test/widgets",
      ].sort(),
    );
  });

  it("serves the chart builders from the root, next to the other widget builders", () => {
    const kit = exportedNames(KIT_INDEX);
    for (const name of ["areaChart", "barChart", "lineChart", "pieChart", "metric"]) {
      expect(kit.has(name), name).toBe(true);
    }
  });

  it("gives @flowpanel/kit/test a require condition for Playwright projects compiled to CommonJS", () => {
    expect(pkg.exports["./test"]).toEqual({
      import: { types: "./dist/test.d.ts", default: "./dist/test.js" },
      require: { types: "./dist/test/index.d.cts", default: "./dist/test/index.cjs" },
    });
  });
});
