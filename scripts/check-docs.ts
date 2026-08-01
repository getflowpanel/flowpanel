/**
 * Fails when the docs claim something the packages do not back up:
 * unknown import specifiers, symbols that are not exported, broken internal
 * links (including their #anchor fragments), a hand-copied interface whose
 * members drifted from the source, or an <AutoTypeTable>-documented default
 * that no longer matches the option's runtime fallback.
 *
 * The property rows <AutoTypeTable> renders are generated from the .d.ts and
 * cannot drift on their own — this covers the prose and JSDoc around them.
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

/** Every package source file, cached once, so consumer defaults can be searched cheaply. */
const sourceTextByFile = new Map(
  [...walk(PACKAGES, ".ts"), ...walk(PACKAGES, ".tsx")].map((f) => [f, readFileSync(f, "utf8")]),
);

/** Strips a single layer of backticks or double quotes, repeatedly (handles `"nested"`). */
function unquote(raw: string): string {
  let v = raw;
  while ((v.startsWith("`") && v.endsWith("`")) || (v.startsWith('"') && v.endsWith('"'))) {
    v = v.slice(1, -1);
  }
  return v;
}

/** A literal default value, as written in either a JSDoc comment or a `?? ` fallback. */
const DEFAULT_LITERAL = '(`[^`]+`|"[^"]+"|-?\\d+(?:\\.\\d+)?|true|false)';

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

function pagePathOf(file: string): string {
  return `/docs/${relative(DOCS, file)
    .replace(/\.mdx$/, "")
    .replace(/\/index$/, "")}`;
}

/** Approximates the slugger the docs renderer uses for heading ids (github-slugger). */
function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .trim()
    .replace(/ +/g, "-");
}

const docFiles = walk(DOCS, ".mdx");
const pages = new Set(docFiles.map(pagePathOf));

/** Heading slugs per page, so a link's `#anchor` can be checked like the rest of it. */
const headingsByPage = new Map<string, Set<string>>();
for (const file of docFiles) {
  const body = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  const slugs = new Set<string>();
  for (const m of body.matchAll(/^#{1,6}[ \t]+(.+)$/gm)) slugs.add(slugify(m[1]));
  headingsByPage.set(pagePathOf(file), slugs);
}

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

  for (const m of text.matchAll(/\]\((\/docs\/[^)#\s]*)(#[^)\s]*)?\)/g)) {
    const target = m[1].replace(/\/$/, "");
    if (!pages.has(target)) {
      report(file, `links to ${m[1]}, which is not a docs page`);
      continue;
    }
    const anchor = m[2]?.slice(1);
    if (anchor && !headingsByPage.get(target)?.has(anchor)) {
      report(file, `links to ${target}#${anchor}, which has no matching heading on that page`);
    }
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

  // <AutoTypeTable> renders an interface's own JSDoc, so a "Defaults to X" comment is a
  // promise about runtime behavior. Only compared where the consumer reads it off something
  // literally named `options` — the one access shape common enough across widget/resource/
  // adapter option bags to compare safely without misattributing an unrelated same-named field.
  for (const m of text.matchAll(/<AutoTypeTable[^>]*\bname="([^"]+)"/g)) {
    const body = declarations.get(m[1]);
    if (!body) continue;
    for (const dm of body.matchAll(
      /\/\*\*\s*(.*?)\s*\*\/\s*\n\s*(?:readonly\s+)?([A-Za-z_]\w*)\??\s*[:(<]/gs,
    )) {
      const literal = new RegExp(`Defaults to ${DEFAULT_LITERAL}\\.?`).exec(dm[1]);
      if (!literal) continue;
      const member = dm[2];
      const docValue = unquote(literal[1]);
      const consumerRe = new RegExp(
        `\\boptions\\??\\.${member}\\s*\\?\\?\\s*${DEFAULT_LITERAL}`,
        "g",
      );
      for (const [srcFile, srcText] of sourceTextByFile) {
        for (const cm of srcText.matchAll(consumerRe)) {
          const runtimeValue = unquote(cm[1]);
          if (runtimeValue === docValue) continue;
          const line = srcText.slice(0, cm.index).split("\n").length;
          report(
            file,
            `<AutoTypeTable name="${m[1]}"> says ${member} defaults to ${docValue}, but ` +
              `${relative(ROOT, srcFile)}:${line} defaults it to ${runtimeValue}`,
          );
        }
      }
    }
  }
}

const allowlist = new Set(
  readFileSync(join(ROOT, "scripts/docs-coverage-allowlist.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#")),
);
const docsCorpus = docFiles.map((f) => readFileSync(f, "utf8")).join("\n");
let coveredCount = 0;
for (const [pkg, names] of exportsByPackage) {
  if (pkg === "@flowpanel/kit") continue;
  for (const name of names) {
    if (allowlist.has(name)) continue;
    if (!new RegExp(`\\b${name}\\b`).test(docsCorpus)) {
      problems.push(`${pkg}: export "${name}" appears in no docs page`);
    } else {
      coveredCount++;
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} docs problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `✔ docs verified — ${docFiles.length} pages, imports, links and type blocks agree, ${coveredCount} exports documented`,
);
