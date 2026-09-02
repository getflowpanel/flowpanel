import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { Project } from "ts-morph";
import { readCompatibility } from "../../apps/site/src/shared/lib/compatibility";
import { checkApiOwnership } from "./api-ownership";
import { DEFAULT_DOC_CONTRACTS } from "./default-contracts";
import { docRoute, lineAt, walkFiles } from "./files";
import { collectPublicSymbols } from "./public-api";
import { renderReadmeCompatibility } from "./readme-compatibility";
import { RUNTIME_DOC_CLAIMS } from "./runtime-claims";
import type { DocsProblem, PublicSymbol } from "./types";

interface CheckApiOptions {
  ownership?: boolean;
  contracts?: boolean;
}

function displayPath(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

function specifierFor(symbol: PublicSymbol): string {
  return symbol.exportPath === "."
    ? symbol.packageName
    : `${symbol.packageName}${symbol.exportPath.slice(1)}`;
}

function checkContracts(root: string, project: Project): DocsProblem[] {
  const problems: DocsProblem[] = [];
  for (const contract of DEFAULT_DOC_CONTRACTS) {
    const declaration = project
      .getSourceFiles()
      .flatMap((file) => file.getInterfaces())
      .find((item) => item.getName() === contract.typeName);
    const member = declaration?.getProperty(contract.member);
    const value = member
      ?.getJsDocs()
      .flatMap((doc) => doc.getTags())
      .find((tag) => tag.getTagName() === "defaultValue")
      ?.getCommentText()
      ?.trim();
    if (value !== contract.value) {
      problems.push({
        code: "api-default-jsdoc",
        file: declaration
          ? displayPath(root, declaration.getSourceFile().getFilePath())
          : "packages",
        line: member?.getStartLineNumber() ?? 1,
        message: `${contract.typeName}.${contract.member} declares @defaultValue ${value ?? "<missing>"}; expected ${contract.value}.`,
        suggestion: "Update the JSDoc and runtime contract together.",
      });
    }
    const consumer = join(root, contract.consumerFile);
    if (
      !existsSync(consumer) ||
      !readFileSync(consumer, "utf8").includes(contract.consumerExpression)
    ) {
      problems.push({
        code: "api-default-consumer",
        file: contract.consumerFile,
        line: 1,
        message: `${contract.typeName}.${contract.member} no longer has its checked runtime default expression.`,
        suggestion: `Restore or update: ${contract.consumerExpression}`,
      });
    }
  }
  return problems;
}

export function checkApi(root: string, options: CheckApiOptions = {}): DocsProblem[] {
  const docsRoot = join(root, "apps/site/content/docs");
  const siteRoot = join(root, "apps/site");
  const files = existsSync(docsRoot) ? walkFiles(docsRoot, ".mdx") : [];
  const symbols = collectPublicSymbols(root);
  const namesBySpecifier = new Map<string, Set<string>>();
  for (const symbol of symbols) {
    const names = namesBySpecifier.get(specifierFor(symbol)) ?? new Set<string>();
    names.add(symbol.exportName);
    namesBySpecifier.set(specifierFor(symbol), names);
  }
  const project = new Project({
    ...(existsSync(join(root, "tsconfig.base.json"))
      ? { tsConfigFilePath: join(root, "tsconfig.base.json") }
      : {}),
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths([
    join(root, "packages/*/src/**/*.ts"),
    join(root, "packages/*/src/**/*.tsx"),
  ]);
  const problems: DocsProblem[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const display = displayPath(root, file);
    for (const match of source.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["'](@[^"']+)["']/gs,
    )) {
      const specifier = match[2] ?? "";
      const known = namesBySpecifier.get(specifier);
      if (!known) {
        if (specifier.startsWith("@flowpanel/"))
          problems.push({
            code: "api-import-specifier",
            file: display,
            line: lineAt(source, match.index),
            message: `Package export does not exist: ${specifier}.`,
            suggestion: "Use a specifier declared in package.json#exports.",
          });
        continue;
      }
      for (const item of (match[1] ?? "").split(",")) {
        const name = item
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)[0]
          ?.trim();
        if (name && !known.has(name))
          problems.push({
            code: "api-import-symbol",
            file: display,
            line: lineAt(source, match.index),
            message: `${name} is not exported from ${specifier}.`,
            suggestion: "Use a compiler-discovered public export or fix the example.",
          });
      }
    }

    for (const match of source.matchAll(
      /<(AutoTypeTable|ApiSignature)\b[^>]*\bpath="([^"]+)"[^>]*\bname="([^"]+)"[^>]*\/?\s*>/g,
    )) {
      const path = resolve(siteRoot, match[2] ?? "");
      const name = match[3] ?? "";
      const sourceFile = existsSync(path)
        ? (project.getSourceFile(path) ?? project.addSourceFileAtPath(path))
        : undefined;
      const exported = sourceFile?.getExportSymbols().some((symbol) => symbol.getName() === name);
      if (!exported)
        problems.push({
          code: "api-component-symbol",
          file: display,
          line: lineAt(source, match.index),
          message: `${match[1]} cannot resolve exported symbol ${name} from ${match[2]}.`,
          suggestion: "Point the generated block at a real exported declaration.",
        });
    }
  }

  if (options.ownership !== false) {
    problems.push(
      ...checkApiOwnership(symbols, new Set(files.map((file) => docRoute(file, docsRoot)))),
    );
  }
  if (options.contracts !== false) {
    problems.push(...checkContracts(root, project));
    try {
      readCompatibility(root);
      const readme = readFileSync(join(root, "README.md"), "utf8");
      if (!readme.includes(renderReadmeCompatibility(root))) {
        problems.push({
          code: "readme-compatibility-stale",
          file: "README.md",
          line: 1,
          message: "README compatibility ranges do not match package metadata.",
          suggestion: "Run pnpm docs:generate.",
        });
      }
    } catch (error) {
      problems.push({
        code: "compatibility-source",
        file: "packages",
        line: 1,
        message: error instanceof Error ? error.message : String(error),
        suggestion: "Restore the package metadata field used by the compatibility table.",
      });
    }
    for (const claim of RUNTIME_DOC_CLAIMS) {
      const testFile = join(root, claim.testFile);
      if (!existsSync(testFile) || !readFileSync(testFile, "utf8").includes(claim.testName))
        problems.push({
          code: "runtime-claim-test",
          file: claim.testFile,
          line: 1,
          message: `Runtime claim ${claim.id} is no longer backed by test "${claim.testName}".`,
          suggestion: "Update the claim to an equivalent test or restore the behavior test.",
        });
    }
  }
  return problems;
}
