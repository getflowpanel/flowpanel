/**
 * Fails when the docs claim something the packages do not back up:
 * unknown import specifiers, symbols that are not exported, broken internal
 * links, or a hand-copied interface whose members drifted from the source.
 *
 * Property tables rendered by <AutoTypeTable> are generated from the .d.ts and
 * cannot drift, so they need no checking — this covers the prose around them.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const DOCS = join(ROOT, "apps/site/content/docs");
const PACKAGES = join(ROOT, "packages");

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "dist" || entry === "__tests__") continue;
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (full.endsWith(ext)) out.push(full);
  }
  return out;
}

const problems: string[] = [];
const report = (file: string, msg: string) => problems.push(`${relative(ROOT, file)}: ${msg}`);

const packageDirs = readdirSync(PACKAGES).filter((d) => statSync(join(PACKAGES, d)).isDirectory());

/** Valid import specifiers, from each package's own `exports` map. */
const specifiers = new Set<string>();
/** Exported identifiers per package name. */
const exportsByPackage = new Map<string, Set<string>>();

for (const dir of packageDirs) {
  const pkgPath = join(PACKAGES, dir, "package.json");
  let pkg: { name?: string; exports?: Record<string, unknown>; private?: boolean };
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    continue;
  }
  if (!pkg.name || pkg.private) continue;
  for (const sub of Object.keys(pkg.exports ?? { ".": {} })) {
    specifiers.add(sub === "." ? pkg.name : `${pkg.name}${sub.slice(1)}`);
  }

  const index = join(PACKAGES, dir, "src/index.ts");
  const names = new Set<string>();
  try {
    const src = readFileSync(index, "utf8");
    for (const m of src.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/gs)) {
      for (const raw of m[1].split(",")) {
        const name = raw
          .trim()
          .replace(/^type\s+/, "")
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name) names.add(name);
      }
    }
    for (const m of src.matchAll(
      /export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class|interface|type)\s+(\w+)/g,
    )) {
      names.add(m[1]);
    }
  } catch {
    // no barrel file (the CLI, for instance) — nothing to verify against
  }
  exportsByPackage.set(pkg.name, names);
}

/** The kit re-exports the whole surface, so accept any package's export there. */
const everyExport = new Set<string>();
for (const [name, names] of exportsByPackage) {
  if (name !== "@flowpanel/kit") for (const n of names) everyExport.add(n);
}
exportsByPackage.set("@flowpanel/kit", everyExport);

/** Real type declarations, so hand-copied blocks can be diffed against them. */
const declarations = new Map<string, string>();
for (const file of walk(PACKAGES, ".ts")) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/export interface (\w+)\b[^{]*\{/g)) {
    const start = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    if (!declarations.has(m[1])) declarations.set(m[1], src.slice(start, i - 1));
  }
}

function topLevelMembers(body: string): Set<string> {
  const out = new Set<string>();
  let depth = 0;
  for (const line of body.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("//") || s.startsWith("*") || s.startsWith("/*")) continue;
    if (depth === 0) {
      const m = /^(?:readonly\s+)?([A-Za-z_]\w*)\??\s*[:(<]/.exec(s);
      if (m) out.add(m[1]);
    }
    depth += (s.match(/\{/g)?.length ?? 0) - (s.match(/\}/g)?.length ?? 0);
  }
  return out;
}

const docFiles = walk(DOCS, ".mdx");
const pages = new Set(
  docFiles.map(
    (f) =>
      `/docs/${relative(DOCS, f)
        .replace(/\.mdx$/, "")
        .replace(/\/index$/, "")}`,
  ),
);

for (const file of docFiles) {
  const text = readFileSync(file, "utf8");

  for (const m of text.matchAll(/from\s*["'](@flowpanel\/[^"']+)["']/g)) {
    if (!specifiers.has(m[1])) report(file, `imports from "${m[1]}", which no package exports`);
  }

  for (const m of text.matchAll(
    /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](@flowpanel\/[\w-]+)["']/gs,
  )) {
    const known = exportsByPackage.get(m[2]);
    if (!known || known.size === 0) continue;
    for (const raw of m[1].split(",")) {
      const name = raw
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name && !known.has(name)) report(file, `"${name}" is not exported from ${m[2]}`);
    }
  }

  for (const m of text.matchAll(/\]\((\/docs\/[^)#\s]*)(?:#[^)\s]*)?\)/g)) {
    const target = m[1].replace(/\/$/, "");
    if (!pages.has(target)) report(file, `links to ${m[1]}, which is not a docs page`);
  }

  // A fenced block that restates an exported interface must match its members.
  for (const m of text.matchAll(/\ninterface (\w+)\s*\{(.*?)\n\}/gs)) {
    const real = declarations.get(m[1]);
    // Blocks that trail off with a comment are deliberate excerpts.
    if (!real || /\/\/\s*\.\.\./.test(m[2])) continue;
    const documented = topLevelMembers(m[2]);
    const actual = topLevelMembers(real);
    const ghosts = [...documented].filter((k) => !actual.has(k));
    if (ghosts.length > 0) {
      report(file, `${m[1]} documents members that do not exist: ${ghosts.join(", ")}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} docs problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`✔ docs verified — ${docFiles.length} pages, imports, links and type blocks agree`);
