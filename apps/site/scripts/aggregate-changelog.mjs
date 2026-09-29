#!/usr/bin/env node
// Merges every packages/*/CHANGELOG.md into content/changelog/index.mdx, newest version first.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE_DIR = `${path.dirname(fileURLToPath(import.meta.url))}/..`;
const REPO_DIR = path.resolve(SITE_DIR, "../..");
const PACKAGES_DIR = path.join(REPO_DIR, "packages");
const OUT_DIR = path.join(SITE_DIR, "content/changelog");
const OUT_FILE = path.join(OUT_DIR, "index.mdx");

/** @typedef {{ section: string; lines: string[] }} SectionBlock */
/** @typedef {{ version: string; sections: SectionBlock[] }} VersionBlock */
/** @typedef {{ pkg: string; versions: VersionBlock[] }} PackageChangelog */

/** @returns {Promise<PackageChangelog[]>} */
async function readAllChangelogs() {
  const pkgs = await readdir(PACKAGES_DIR, { withFileTypes: true });
  const out = [];
  for (const entry of pkgs) {
    if (!entry.isDirectory()) continue;
    const file = path.join(PACKAGES_DIR, entry.name, "CHANGELOG.md");
    try {
      const raw = await readFile(file, "utf8");
      out.push(parseChangelog(raw));
    } catch {
      // Package without a changelog yet — skip.
    }
  }
  return out;
}

/** @returns {PackageChangelog} */
function parseChangelog(raw) {
  const lines = raw.split(/\r?\n/);
  let pkg = "";
  /** @type {VersionBlock[]} */
  const versions = [];
  /** @type {VersionBlock | null} */
  let curVersion = null;
  /** @type {SectionBlock | null} */
  let curSection = null;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      if (!pkg) pkg = line.slice(2).trim();
      continue;
    }
    if (line.startsWith("## ")) {
      curVersion = { version: line.slice(3).trim(), sections: [] };
      versions.push(curVersion);
      curSection = null;
      continue;
    }
    if (line.startsWith("### ")) {
      if (!curVersion) continue;
      curSection = { section: line.slice(4).trim(), lines: [] };
      curVersion.sections.push(curSection);
      continue;
    }
    if (curSection) curSection.lines.push(line);
    else if (curVersion) {
      // Body before any ### — treat as a default "Changes" section.
      if (!curSection) {
        curSection = { section: "Changes", lines: [] };
        curVersion.sections.push(curSection);
      }
      curSection.lines.push(line);
    }
  }

  return { pkg, versions };
}

/** Group: version → pkg → sections[]. */
function groupByVersion(/** @type {PackageChangelog[]} */ all) {
  /** @type {Map<string, Map<string, SectionBlock[]>>} */
  const byVersion = new Map();
  for (const { pkg, versions } of all) {
    for (const v of versions) {
      if (!byVersion.has(v.version)) byVersion.set(v.version, new Map());
      byVersion.get(v.version).set(pkg, v.sections);
    }
  }
  return byVersion;
}

/** Sort versions semver-desc; non-semver tags float to top in insertion order. */
function sortedVersions(/** @type {Iterable<string>} */ versions) {
  const arr = [...versions];
  arr.sort((a, b) => {
    const aa = parseSemver(a);
    const bb = parseSemver(b);
    if (!aa && !bb) return a < b ? 1 : -1;
    if (!aa) return -1;
    if (!bb) return 1;
    for (let i = 0; i < 3; i++) {
      if (aa[i] !== bb[i]) return bb[i] - aa[i];
    }
    return 0;
  });
  return arr;
}

function parseSemver(/** @type {string} */ v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

// The changelog compiles as MDX, so `{` and `<` outside code are escaped; one stray brace broke the deploy.
export function escapeMdxProse(/** @type {string} */ body) {
  let inFence = false;
  return body
    .split("\n")
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : escapeOutsideCodeSpans(line);
    })
    .join("\n");
}

function escapeOutsideCodeSpans(/** @type {string} */ line) {
  // A span closes on a backtick run of the same length, so ``a ` b`` is one span.
  const spans = /(`+)(.*?)\1(?!`)/g;
  let out = "";
  let read = 0;
  for (let span = spans.exec(line); span; span = spans.exec(line)) {
    out += escapeSyntax(line.slice(read, span.index)) + span[0];
    read = span.index + span[0].length;
  }
  return out + escapeSyntax(line.slice(read));
}

const escapeSyntax = (/** @type {string} */ text) => text.replace(/[{<]/g, "\\$&");

/** Compose the final MDX body. */
function emit(/** @type {Map<string, Map<string, SectionBlock[]>>} */ byVersion) {
  const versions = sortedVersions(byVersion.keys());
  const latest = versions[0];

  const out = [
    "---",
    "title: Changelog",
    "description: Per-package release notes, aggregated newest-first.",
    "---",
    "",
    '<Callout type="warn">',
    "The documentation on this site describes **`main`**" +
      (latest ? `, while the latest published release is **${latest}**.` : "."),
    "Anything documented but not listed below has not shipped yet. When a docs",
    "page and your installed version disagree, your version wins.",
    "</Callout>",
    "",
  ];

  for (const version of versions) {
    const byPkg = byVersion.get(version);
    const notes = [...byPkg.keys()]
      .sort()
      .map((pkg) => {
        const bodies = byPkg.get(pkg).map((section) => section.lines.join("\n").trim());
        return { pkg, body: escapeMdxProse(bodies.filter(Boolean).join("\n")) };
      })
      .filter(({ body }) => body);
    if (notes.length === 0) continue;
    out.push(`## v${version}`, "");
    for (const { pkg, body } of notes) out.push(`### ${pkg}`, "", body, "");
  }

  return out.join("\n");
}

async function main() {
  const all = await readAllChangelogs();
  if (all.length === 0) {
    console.error("No CHANGELOG.md found under packages/*");
    process.exit(1);
  }
  const byVersion = groupByVersion(all);
  const body = emit(byVersion);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, body, "utf8");
  console.log(
    `✓ wrote ${path.relative(REPO_DIR, OUT_FILE)} — ${byVersion.size} versions, ${all.length} packages`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
