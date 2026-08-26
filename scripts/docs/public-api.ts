import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import {
  type Symbol as MorphSymbol,
  Node,
  Project,
  type SourceFile,
  VariableDeclarationKind,
} from "ts-morph";
import type { PublicSymbol, PublicSymbolKind } from "./types";

interface PackageJson {
  name?: string;
  private?: boolean;
  exports?: Record<string, unknown>;
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function findTypesTarget(value: unknown): string | null {
  if (typeof value === "string") {
    return /\.(?:d\.)?(?:ts|tsx|mts|cts)$/.test(value) ? value : null;
  }
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const preferred = findTypesTarget(record.types);
  if (preferred) return preferred;
  for (const nested of Object.values(record)) {
    const target = findTypesTarget(nested);
    if (target) return target;
  }
  return null;
}

function entryBaseName(target: string): string {
  return basename(target)
    .replace(/\.d\.(?:ts|mts|cts)$/, "")
    .replace(/\.(?:ts|tsx|mts|cts)$/, "");
}

function resolveSourceEntry(packageDir: string, exportPath: string, target: string): string | null {
  const base = entryBaseName(target);
  const subpath = exportPath === "." ? "index" : exportPath.slice(2);
  const names = Array.from(new Set([base, subpath]));
  const candidates = names.flatMap((name) => [
    join(packageDir, "src", `${name}.ts`),
    join(packageDir, "src", `${name}.tsx`),
    join(packageDir, "src", name, "index.ts"),
    join(packageDir, "src", name, "index.tsx"),
  ]);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function declarationKind(node: Node): PublicSymbolKind {
  if (Node.isClassDeclaration(node)) return "class";
  if (Node.isEnumDeclaration(node)) return "enum";
  if (Node.isFunctionDeclaration(node)) return "function";
  if (Node.isInterfaceDeclaration(node)) return "interface";
  if (Node.isTypeAliasDeclaration(node)) return "type";
  if (Node.isVariableDeclaration(node)) {
    return node.getVariableStatement()?.getDeclarationKind() === VariableDeclarationKind.Const
      ? "const"
      : "unknown";
  }
  return "unknown";
}

function declarationName(node: Node, fallback: string): string {
  if (
    Node.isClassDeclaration(node) ||
    Node.isEnumDeclaration(node) ||
    Node.isFunctionDeclaration(node) ||
    Node.isInterfaceDeclaration(node) ||
    Node.isTypeAliasDeclaration(node) ||
    Node.isVariableDeclaration(node)
  ) {
    return node.getName() ?? fallback;
  }
  return fallback;
}

function isExplicitTypeExport(sourceFile: SourceFile, exportName: string): boolean {
  for (const declaration of sourceFile.getExportDeclarations()) {
    for (const specifier of declaration.getNamedExports()) {
      if ((specifier.getAliasNode()?.getText() ?? specifier.getName()) !== exportName) continue;
      return specifier.isTypeOnly() || declaration.isTypeOnly();
    }
  }
  return false;
}

function actualSymbol(symbol: MorphSymbol): MorphSymbol {
  return symbol.getAliasedSymbol() ?? symbol;
}

function sourceCounterpart(root: string, declarationPath: string): string | null {
  const normalized = normalizePath(declarationPath);
  const match = normalized.match(/^(packages\/[^/]+)\/dist\/(.+)\.d\.(?:ts|mts|cts)$/);
  if (!match) return null;

  const sourceBase = join(root, match[1], "src", match[2]);
  const candidates = [
    `${sourceBase}.ts`,
    `${sourceBase}.tsx`,
    join(sourceBase, "index.ts"),
    join(sourceBase, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function sourceDeclaration(
  project: Project,
  root: string,
  declaration: Node,
  exportName: string,
  visited = new Set<string>(),
): Node {
  const declarationPath = declaration.getSourceFile().getFilePath();
  const relativePath = normalizePath(relative(root, declarationPath));
  const counterpart = sourceCounterpart(root, relativePath);
  if (!counterpart || visited.has(counterpart)) return declaration;
  visited.add(counterpart);

  const sourceFile = project.getSourceFile(counterpart) ?? project.addSourceFileAtPath(counterpart);
  const exported = sourceFile.getExportSymbols().find((symbol) => symbol.getName() === exportName);
  if (!exported) return declaration;
  const resolved = actualSymbol(exported);
  const resolvedDeclaration = resolved.getDeclarations()[0] ?? exported.getDeclarations()[0];
  if (!resolvedDeclaration) return declaration;
  return sourceDeclaration(project, root, resolvedDeclaration, resolved.getName(), visited);
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function collectPublicSymbols(root: string): PublicSymbol[] {
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) return [];

  const tsconfigPath = join(root, "tsconfig.base.json");
  const project = new Project({
    ...(existsSync(tsconfigPath) ? { tsConfigFilePath: tsconfigPath } : {}),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths([
    join(packagesDir, "*/src/**/*.ts"),
    join(packagesDir, "*/src/**/*.tsx"),
  ]);

  const result: PublicSymbol[] = [];
  const packageDirs = readdirSync(packagesDir)
    .map((name) => join(packagesDir, name))
    .filter((path) => statSync(path).isDirectory())
    .sort(compareText);

  for (const packageDir of packageDirs) {
    const packageJsonPath = join(packageDir, "package.json");
    if (!existsSync(packageJsonPath)) continue;
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as PackageJson;
    if (!packageJson.name || packageJson.private || !packageJson.exports) continue;

    for (const exportPath of Object.keys(packageJson.exports).sort(compareText)) {
      if (exportPath === "./package.json") continue;
      const target = findTypesTarget(packageJson.exports[exportPath]);
      if (!target) continue;
      const entryPath = resolveSourceEntry(packageDir, exportPath, target);
      if (!entryPath) continue;
      const entry = project.getSourceFile(entryPath) ?? project.addSourceFileAtPath(entryPath);

      for (const exported of entry.getExportSymbols()) {
        const exportName = exported.getName();
        if (exportName === "default") continue;
        const resolved = actualSymbol(exported);
        const resolvedDeclaration = resolved.getDeclarations()[0] ?? exported.getDeclarations()[0];
        if (!resolvedDeclaration) continue;
        const declaration = sourceDeclaration(
          project,
          root,
          resolvedDeclaration,
          resolved.getName(),
        );
        const kind = declarationKind(declaration);
        result.push({
          packageName: packageJson.name,
          exportPath,
          exportName,
          kind,
          declarationPath: normalizePath(relative(root, declaration.getSourceFile().getFilePath())),
          declarationName: declarationName(declaration, resolved.getName()),
          isTypeOnly:
            kind === "interface" || kind === "type" || isExplicitTypeExport(entry, exportName),
        });
      }
    }
  }

  return result.sort(
    (a, b) =>
      compareText(a.packageName, b.packageName) ||
      compareText(a.exportPath, b.exportPath) ||
      compareText(a.exportName, b.exportName),
  );
}
