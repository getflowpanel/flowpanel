import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const posix = (path) => path.split(sep).join("/");

export function directivePrologue(text) {
  return /^(?:\s*(?:"[^"\n]*"|'[^'\n]*')\s*;)*/.exec(text)?.[0] ?? "";
}

/** For a module of only named or bare imports and `export { … }` lists, each exported name → `{ from, name }` it re-exports; otherwise null. */
export function barrelExports(text) {
  const ts = require("typescript");
  const source = ts.createSourceFile("barrel.js", text, ts.ScriptTarget.Latest, false);
  const imported = new Map();
  const exported = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (!clause) continue;
      const bindings = clause.namedBindings;
      if (clause.name || !bindings || !ts.isNamedImports(bindings)) return null;
      for (const element of bindings.elements) {
        const name = (element.propertyName ?? element.name).text;
        imported.set(element.name.text, { from: statement.moduleSpecifier.text, name });
      }
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const local = (element.propertyName ?? element.name).text;
        const origin = statement.moduleSpecifier
          ? { from: statement.moduleSpecifier.text, name: local }
          : imported.get(local);
        if (!origin) return null;
        exported.set(element.name.text, origin);
      }
    } else {
      return null;
    }
  }
  return exported.size ? exported : null;
}

/** Points named imports of a barrel at the modules that define each name, so webpack keeps their client code apart. */
export function flattenBarrelImports(text, file, barrelOf) {
  const ts = require("typescript");
  const source = ts.createSourceFile("module.js", text, ts.ScriptTarget.Latest, false);
  const edits = [];
  for (const statement of source.statements) {
    const isImport = ts.isImportDeclaration(statement);
    if ((!isImport && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".")) continue;
    const target = resolve(dirname(file), specifier);
    if (!barrelOf(target)) continue;
    let elements;
    if (isImport) {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      if (!clause || clause.name || clause.isTypeOnly || !bindings || !ts.isNamedImports(bindings))
        continue;
      elements = bindings.elements;
    } else {
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
      elements = statement.exportClause.elements;
    }
    const groups = new Map();
    for (const element of elements) {
      let origin = { file: target, name: (element.propertyName ?? element.name).text };
      for (let barrel = barrelOf(origin.file); barrel; barrel = barrelOf(origin.file)) {
        const next = barrel.get(origin.name);
        if (!next) break;
        origin = { file: resolve(dirname(origin.file), next.from), name: next.name };
      }
      const alias = element.name.text;
      const binding = origin.name === alias ? alias : `${origin.name} as ${alias}`;
      groups.set(origin.file, [...(groups.get(origin.file) ?? []), binding]);
    }
    const keyword = isImport ? "import" : "export";
    const replacement = [...groups]
      .map(([origin, bindings]) => {
        let path = posix(relative(dirname(file), origin));
        if (!path.startsWith(".")) path = `./${path}`;
        return `${keyword} { ${bindings.join(", ")} } from "${path}";`;
      })
      .join("\n");
    edits.push({ start: statement.getStart(source), end: statement.end, replacement });
  }
  let output = text;
  for (const { start, end, replacement } of edits.reverse()) {
    output = `${output.slice(0, start)}${replacement}${output.slice(end)}`;
  }
  return output;
}

/** Points every shipped module's named imports of an internal barrel at the defining modules; the kit's own entries stay barrels. */
export function flattenBarrels(code, dist) {
  const barrels = new Map();
  for (const file of code) {
    const text = readFileSync(file, "utf8");
    if (directivePrologue(text).trim() || dirname(file) === dist) continue;
    const exported = barrelExports(text);
    if (exported) barrels.set(file, exported);
  }
  for (const file of code) {
    const text = readFileSync(file, "utf8");
    const output = flattenBarrelImports(text, file, (path) => barrels.get(path));
    if (output !== text) writeFileSync(file, output);
  }
  for (const file of code.filter((path) => dirname(path) === dist)) {
    const entry = clientEntry(readFileSync(file, "utf8"), file, (path) => barrels.get(path));
    if (entry) writeFileSync(file, entry);
  }
}

const isClientModule = (file) =>
  /["']use client["']/.test(directivePrologue(readFileSync(file, "utf8")));

/** An entry that re-exports only barrels of `"use client"` modules becomes a `"use client"` module naming each export. */
export function clientEntry(text, file, barrelOf, isClient = isClientModule) {
  const ts = require("typescript");
  const source = ts.createSourceFile("entry.js", text, ts.ScriptTarget.Latest, false);
  const lines = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause || !statement.moduleSpecifier)
      return null;
    const target = resolve(dirname(file), statement.moduleSpecifier.text);
    const barrel = barrelOf(target);
    if (!barrel) return null;
    const groups = new Map();
    for (const [name, origin] of barrel) {
      const from = resolve(dirname(target), origin.from);
      if (!isClient(from)) return null;
      const binding = origin.name === name ? name : `${origin.name} as ${name}`;
      groups.set(from, [...(groups.get(from) ?? []), binding]);
    }
    for (const [from, bindings] of groups) {
      lines.push(
        `export { ${bindings.join(", ")} } from "./${posix(relative(dirname(file), from))}";`,
      );
    }
  }
  return lines.length ? `"use client";\n${lines.join("\n")}\n` : null;
}
