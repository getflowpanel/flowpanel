import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Project } from "ts-morph";
import { readTsconfigOptions } from "./tsconfig";

/** Resolve local config imports without importing their runtime dependencies. */
export async function resolveProjectModule(
  cwd: string,
  specifier: string,
  fromFile = path.join(cwd, "flowpanel.config.ts"),
): Promise<string | null> {
  if (!specifier || /["'`\r\n\0]/.test(specifier)) return null;
  const candidates: string[] = [];
  if (specifier.startsWith(".")) candidates.push(path.resolve(path.dirname(fromFile), specifier));
  else if (path.isAbsolute(specifier)) candidates.push(specifier);
  else {
    const opts = await readTsconfigOptions(cwd);
    for (const [alias, targets] of Object.entries(opts?.paths ?? {})) {
      const [prefix, suffix = ""] = alias.split("*");
      if (!prefix || !specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
      if (!alias.includes("*") && alias !== specifier) continue;
      const wildcard = specifier.slice(prefix.length, suffix ? -suffix.length : undefined);
      for (const target of targets)
        candidates.push(path.resolve(cwd, opts?.baseUrl ?? ".", target.replace("*", wildcard)));
    }
  }
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs"];
  for (const base of candidates) {
    const paths = [
      base,
      ...extensions.map((ext) => `${base}${ext}`),
      ...extensions.map((ext) => path.join(base, `index${ext}`)),
    ];
    for (const file of paths) {
      if ((await fs.stat(file).catch(() => null))?.isFile()) return file;
    }
  }
  return null;
}

export async function validateProjectImport(
  cwd: string,
  specifier: string,
  exportName?: string,
): Promise<string | null> {
  const file = await resolveProjectModule(cwd, specifier);
  if (!file)
    return `Cannot resolve "${specifier}" from the project config. Choose an existing local module.`;
  if (!exportName) return null;
  const options = await readTsconfigOptions(cwd);
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      baseUrl: path.resolve(cwd, options?.baseUrl ?? "."),
      ...(options?.paths ? { paths: options.paths } : {}),
    },
  });
  const visited = new Set<string>();
  async function loadExports(moduleFile: string): Promise<void> {
    if (visited.has(moduleFile)) return;
    visited.add(moduleFile);
    const source = project.createSourceFile(moduleFile, await fs.readFile(moduleFile, "utf8"));
    for (const declaration of source.getExportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      if (!specifier) continue;
      const target = await resolveProjectModule(cwd, specifier, moduleFile);
      if (target) await loadExports(target);
    }
  }
  await loadExports(file);
  const source = project.getSourceFileOrThrow(file);
  const exported = source.getExportSymbols().some((symbol) => symbol.getName() === exportName);
  return exported
    ? null
    : `${path.relative(cwd, file)} does not declare export "${exportName}". Point to a module exporting it.`;
}
