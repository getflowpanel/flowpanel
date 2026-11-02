import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { directivePrologue, flattenBarrels } from "./flatten-barrels.mjs";

export { directivePrologue };

const require = createRequire(import.meta.url);
export const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DIST = join(KIT, "dist");
const KNOWN_DUPLICATES = new Set(
  JSON.parse(readFileSync(join(KIT, "scripts/duplicate-modules.json"), "utf8")),
);

export const INTERNAL_PACKAGES = [
  "core",
  "next",
  "react",
  "charts",
  "client",
  "adapter-drizzle",
  "adapter-prisma",
  "adapter-bullmq",
  "test",
];

const CODE = /\.(?:[cm]?js|d\.[cm]?ts)$/;
const CJS = /\.(?:cjs|d\.cts)$/;
const FLOWPANEL_IMPORT = /\b(?:from|import|require)\s*\(?\s*["'`]@flowpanel\//;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const posix = (path) => path.split(sep).join("/");
const isTypes = (file) => /\.d\.[cm]?ts$/.test(file);

/** Every module specifier in `text` as TypeScript's scanner sees it: imports, re-exports, `import()`, `require()` and `declare module`. */
export function specifiers(text) {
  const ts = require("typescript");
  const { importedFiles, typeReferenceDirectives } = ts.preProcessFile(text, true, true);
  const found = importedFiles.map(({ fileName, pos }) => ({ name: fileName, start: pos + 1 }));
  for (const { fileName } of typeReferenceDirectives) found.push({ name: fileName, start: -1 });
  return found.filter(
    ({ name, start }) => start < 0 || text.slice(start, start + name.length) === name,
  );
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function conditionsFor(file) {
  const cjs = CJS.test(file);
  if (isTypes(file)) return cjs ? ["types", "require", "default"] : ["types", "import", "default"];
  return cjs ? ["require", "default"] : ["import", "default"];
}

export function pick(entry, conditions) {
  if (typeof entry === "string") return entry;
  if (!entry || typeof entry !== "object") return null;
  for (const [key, value] of Object.entries(entry)) {
    if (!conditions.includes(key)) continue;
    const hit = pick(value, conditions);
    if (hit) return hit;
  }
  return null;
}

/** name → { exports, distOf(target) } for the kit and every internal package. */
export function packageMap(packagesDir = resolve(KIT, ".."), dist = DIST) {
  const map = new Map();
  const kit = readJson(join(packagesDir, "flowpanel", "package.json"));
  map.set(kit.name, {
    exports: kit.exports,
    distOf: (target) => join(packagesDir, "flowpanel", target),
  });
  for (const directory of INTERNAL_PACKAGES) {
    const manifest = readJson(join(packagesDir, directory, "package.json"));
    map.set(manifest.name, {
      directory,
      exports: manifest.exports,
      distOf: (target) =>
        target.startsWith("./dist/") ? join(dist, directory, target.slice("./dist/".length)) : null,
    });
  }
  return map;
}

/** The shipped file a `@flowpanel/<pkg>[/<subpath>]` specifier means in `file`, through the package's own exports. */
export function resolveSpecifier(specifier, file, packages) {
  const [scope, name, ...rest] = specifier.split("/");
  const pkg = packages.get(`${scope}/${name}`);
  if (!pkg) return { error: "names no package the kit ships" };
  const subpath = rest.length ? `./${rest.join("/")}` : ".";
  const entry = pkg.exports?.[subpath];
  if (entry === undefined) return { error: `is not in the exports of ${scope}/${name}` };
  const conditions = conditionsFor(file);
  const target = pick(entry, conditions);
  if (!target) return { error: `has no ${conditions.join("/")} target` };
  if (isTypes(file) && !isTypes(target)) return { error: `resolves types to ${target}` };
  const shipped = pkg.distOf(target);
  if (!shipped) return { error: `resolves outside dist (${target})` };
  if (!existsSync(shipped))
    return { error: `resolves to ${posix(relative(KIT, shipped))}, which was not shipped` };
  let path = posix(relative(dirname(file), shipped));
  if (!path.startsWith(".")) path = `./${path}`;
  if (isTypes(file)) path = path.replace(/\.d\.([cm]?)ts$/, ".$1js");
  return { path };
}

export function rewriteFile(text, file, packages) {
  const errors = [];
  let output = text;
  const found = specifiers(text).filter(
    ({ name, start }) => start >= 0 && name.startsWith("@flowpanel/"),
  );
  for (const { name, start } of found.sort((a, b) => b.start - a.start)) {
    const resolved = resolveSpecifier(name, file, packages);
    if (resolved.error) errors.push(`${posix(relative(KIT, file))}: "${name}" ${resolved.error}`);
    else output = `${output.slice(0, start)}${resolved.path}${output.slice(start + name.length)}`;
  }
  return { output, errors };
}

/** True when `text` holds only `export … from "…"` declarations, so a module that loads it loads nothing else. */
export function onlyReexports(text) {
  const ts = require("typescript");
  const source = ts.createSourceFile("entry.ts", text, ts.ScriptTarget.Latest, false);
  return source.statements.every(
    (statement, index) =>
      (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) ||
      (index === 0 &&
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === "use client"),
  );
}

/** The `// src/…` regions esbuild leaves in a bundle, as `<package>/<source path>`. */
export function sourceModules(text, directory) {
  return [...text.matchAll(/^\/\/ (\S+)$/gm)].map(([, path]) => `${directory}/${path}`);
}

function cjsTargets() {
  const targets = new Set();
  const collect = (entry, inRequire) => {
    if (typeof entry === "string") {
      if (inRequire) targets.add(join(KIT, entry));
    } else if (entry && typeof entry === "object") {
      for (const [key, value] of Object.entries(entry))
        collect(value, inRequire || key === "require");
    }
  };
  collect(readJson(join(KIT, "package.json")).exports, false);
  return targets;
}

function copyInternal(directory) {
  const source = resolve(KIT, "..", directory, "dist");
  if (!existsSync(source)) throw new Error(`packages/${directory}/dist is missing; build it first`);
  const target = join(DIST, directory);
  rmSync(target, { recursive: true, force: true });
  const copied = [];
  for (const file of walk(source)) {
    const destination = join(target, relative(source, file));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(file, destination);
    copied.push({ source: file, destination });
  }
  return copied;
}

/** The CommonJS files a `require` export reaches through relative imports; the rest are deleted. */
function pruneCjs() {
  const reached = new Set();
  const queue = [...cjsTargets()];
  while (queue.length) {
    const file = queue.pop();
    if (reached.has(file) || !existsSync(file)) continue;
    reached.add(file);
    if (!file.endsWith(".d.cts")) queue.push(file.replace(/\.cjs$/, ".d.cts"));
    for (const { name } of specifiers(readFileSync(file, "utf8"))) {
      if (!name.startsWith(".")) continue;
      const target = resolve(dirname(file), name);
      queue.push(isTypes(file) ? target.replace(/\.cjs$/, ".d.cts") : target);
    }
  }
  const removed = new Set();
  for (const file of walk(DIST)) {
    if (CJS.test(file) && !reached.has(file)) {
      rmSync(file);
      removed.add(file);
    }
  }
  return removed;
}

/** One `dist/<entry>.js` and `.d.ts` per kit export, each the re-export lines of `src/<entry>.ts`. */
function writeEntries() {
  const problems = [];
  const written = [];
  for (const [subpath, entry] of Object.entries(readJson(join(KIT, "package.json")).exports)) {
    const js = pick(entry, ["import", "default"]);
    if (!js?.startsWith("./dist/") || !js.endsWith(".js") || js.slice(7).includes("/")) continue;
    const name = basename(js, ".js");
    const types = pick(entry, ["types", "import", "default"]);
    if (types !== `./dist/${name}.d.ts`) {
      problems.push(`exports["${subpath}"]: types ${types} do not sit next to ${js}`);
      continue;
    }
    const source = join(KIT, "src", `${name}.ts`);
    if (!existsSync(source)) {
      problems.push(`exports["${subpath}"]: src/${name}.ts is missing`);
      continue;
    }
    const text = readFileSync(source, "utf8");
    if (!onlyReexports(text)) {
      problems.push(`src/${name}.ts: an entry may only re-export a workspace package`);
      continue;
    }
    for (const file of [join(DIST, `${name}.js`), join(DIST, `${name}.d.ts`)]) {
      writeFileSync(file, text);
      written.push(file);
    }
  }
  return { written, problems };
}

function relativeTargetExists(file, specifier) {
  const base = resolve(dirname(file), specifier);
  const candidates = isTypes(file)
    ? [base.replace(/\.([cm]?)js$/, ".d.$1ts"), `${base}.d.ts`, join(base, "index.d.ts")]
    : [base];
  return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function packageName(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function checkSpecifiers(file, text, allowed, builtins, problems) {
  const shown = posix(relative(KIT, file));
  if (FLOWPANEL_IMPORT.test(text)) problems.push(`${shown}: still names an @flowpanel/ module`);
  for (const { name: specifier } of specifiers(text)) {
    if (specifier.startsWith("@flowpanel/")) {
      problems.push(`${shown}: still imports "${specifier}"`);
    } else if (specifier.startsWith(".")) {
      if (!relativeTargetExists(file, specifier))
        problems.push(`${shown}: "${specifier}" does not exist`);
    } else {
      const name = packageName(specifier);
      if (!builtins.has(specifier) && !builtins.has(name) && !allowed.has(name)) {
        problems.push(
          `${shown}: imports "${name}", which is neither a dependency nor a peer of the kit`,
        );
      }
    }
  }
}

function checkDuplicates(regions, problems) {
  for (const [module, files] of regions) {
    if (!module.split("/")[1]?.startsWith("src")) {
      problems.push(`${module}: code from outside its own package is bundled into ${[...files]}`);
    } else if (files.size > 1 && !KNOWN_DUPLICATES.has(module)) {
      problems.push(
        `${module} is bundled into ${[...files].join(" and ")}; one copy only, or add it to scripts/duplicate-modules.json if it holds no state`,
      );
    }
  }
  for (const module of KNOWN_DUPLICATES) {
    if ((regions.get(module)?.size ?? 0) < 2) {
      problems.push(`scripts/duplicate-modules.json: ${module} is no longer duplicated; remove it`);
    }
  }
}

/** Everything that makes the shipped kit self-contained; returns the problems found. */
export function verify(copied = [], entries = []) {
  const problems = [];
  const manifest = readJson(join(KIT, "package.json"));
  const allowed = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const regions = new Map();
  for (const file of walk(DIST)) {
    const shown = posix(relative(KIT, file));
    if (shown.split("/").includes("node_modules"))
      problems.push(`${shown}: node_modules inside dist`);
    if (!CODE.test(file)) continue;
    const text = readFileSync(file, "utf8");
    checkSpecifiers(file, text, allowed, builtins, problems);
    const directory = posix(relative(DIST, file)).split("/")[0];
    if (isTypes(file) || CJS.test(file) || !INTERNAL_PACKAGES.includes(directory)) continue;
    for (const module of new Set(sourceModules(text, directory))) {
      regions.set(module, (regions.get(module) ?? new Set()).add(shown));
    }
  }
  checkDuplicates(regions, problems);
  for (const file of entries) {
    if (!onlyReexports(readFileSync(file, "utf8"))) {
      problems.push(`${posix(relative(KIT, file))}: holds more than re-exports`);
    }
  }
  for (const { source, destination } of copied) {
    if (!CODE.test(destination) || isTypes(destination)) continue;
    const before = directivePrologue(readFileSync(source, "utf8"));
    if (directivePrologue(readFileSync(destination, "utf8")) !== before) {
      problems.push(
        `${posix(relative(KIT, destination))}: lost its directive prologue ${JSON.stringify(before)}`,
      );
    }
  }
  problems.push(...browserProblems());
  return problems;
}

/** The kit entries a browser loads, besides every `"use client"` module. */
const BROWSER_ENTRIES = ["client.js", "react.js", "charts.js"];

/** Each Node built-in a browser bundle would reach: from a browser entry or a `"use client"` module, through relative imports. */
export function browserProblems(dist = DIST) {
  const builtins = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
  const code = walk(dist).filter((file) => /\.m?js$/.test(file) && !CJS.test(file));
  const from = new Map();
  const queue = code.filter((file) => {
    if (BROWSER_ENTRIES.includes(posix(relative(dist, file)))) return true;
    return /["']use client["']/.test(directivePrologue(readFileSync(file, "utf8")));
  });
  for (const root of queue) from.set(root, null);
  const problems = [];
  for (let index = 0; index < queue.length; index++) {
    const file = queue[index];
    for (const { name } of specifiers(readFileSync(file, "utf8"))) {
      if (builtins.has(name) || name.startsWith("node:")) {
        const chain = [];
        for (let at = file; at; at = from.get(at)) chain.unshift(posix(relative(KIT, at)));
        problems.push(`${chain.join(" → ")}: a browser bundle would import "${name}"`);
      } else if (name.startsWith(".")) {
        const target = resolve(dirname(file), name);
        if (existsSync(target) && !from.has(target)) {
          from.set(target, file);
          queue.push(target);
        }
      }
    }
  }
  return problems;
}

/** Rebuilds `dist/` from the internal packages' builds; returns the problems that make the kit unshippable. */
export function vendor() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  const all = INTERNAL_PACKAGES.flatMap((directory) => copyInternal(directory));
  const { written, problems } = writeEntries();
  if (problems.length) return { copied: all, problems };
  const packages = packageMap();
  const errors = new Map();
  for (const file of walk(DIST)) {
    if (!CODE.test(file)) continue;
    const text = readFileSync(file, "utf8");
    const { output, errors: found } = rewriteFile(text, file, packages);
    if (found.length) errors.set(file, found);
    if (output !== text) writeFileSync(file, output);
  }
  flattenBarrels(
    walk(DIST).filter((file) => /\.m?js$/.test(file) && !CJS.test(file)),
    DIST,
  );
  const removed = pruneCjs();
  const kept = [...errors].filter(([file]) => !removed.has(file)).flatMap(([, found]) => found);
  if (kept.length) return { copied: all, problems: kept };
  const copied = all.filter(({ destination }) => !removed.has(destination));
  return { copied, problems: verify(copied, written) };
}
