import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { licenseProblems } from "./sync-licenses.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [...licenseProblems()];
const ORDERED_MANIFEST_MAPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "scripts",
];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function walk(dir, predicate, out = []) {
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry);
    if (["node_modules", ".next", "dist", ".git"].includes(entry)) continue;
    if (statSync(join(root, path)).isDirectory()) walk(path, predicate, out);
    else if (predicate(path)) out.push(path);
  }
  return out;
}

const manifestFiles = [
  "package.json",
  ...walk("apps", (path) => path.endsWith("package.json")),
  ...walk("examples", (path) => path.endsWith("package.json")),
  ...walk("packages", (path) => path.endsWith("package.json")),
].sort();

for (const file of manifestFiles) {
  const manifest = JSON.parse(read(file));
  const orderedMaps = [
    ...ORDERED_MANIFEST_MAPS.map((field) => [field, manifest[field]]),
    ["pnpm.overrides", manifest.pnpm?.overrides],
  ];
  for (const [field, value] of orderedMaps) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const actual = Object.keys(value);
    const expected = [...actual].sort();
    if (actual.some((key, index) => key !== expected[index])) {
      problems.push(`${file}: ${field} keys must be sorted alphabetically`);
    }
  }
}

const publicTextFiles = [
  "README.md",
  ...walk("packages", (path) => path.endsWith("README.md")),
  ...walk("examples", (path) => /(?:README\.md|\.env\.example|\.ya?ml)$/.test(path)),
  ...walk(".github", (path) => /\.(?:md|ya?ml)$/.test(path)),
  ...walk("apps/site/content", (path) => path.endsWith(".mdx")),
  ...walk("apps/site/src", (path) => /\.[jt]sx?$/.test(path)),
];

for (const file of publicTextFiles) {
  const text = read(file);
  if (text.includes("flowpanel.dev")) {
    problems.push(`${file}: uses the retired flowpanel.dev domain`);
  }
  if (text.includes('declare module "@flowpanel/core"')) {
    problems.push(`${file}: teaches consumers to augment internal @flowpanel/core`);
  }
  if (/filters\s*:\s*\[[^\]]*\{\s*key\s*:/s.test(text)) {
    problems.push(`${file}: documents FilterDef with "key"; the public property is "field"`);
  }

  for (const match of text.matchAll(/(?:src|srcset)="([^" ]+)"|!\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1] ?? match[2];
    if (!target || /^(?:https?:|data:|#)/.test(target)) continue;
    const absolute = resolve(root, dirname(file), target);
    if (!existsSync(absolute)) {
      problems.push(`${file}: references missing asset ${target}`);
    }
  }
}

const kit = JSON.parse(read("packages/flowpanel/package.json"));
if (kit.peerDependencies.next.includes("16")) {
  for (const file of publicTextFiles) {
    if (/Next\.js 15\+/.test(read(file))) {
      problems.push(
        `${file}: says Next.js 15+ but the package peer range is ${kit.peerDependencies.next}`,
      );
    }
  }
}
for (const example of ["examples/ai-scraper/package.json", "examples/with-clerk/package.json"]) {
  const pkg = JSON.parse(read(example));
  const zod = pkg.dependencies?.zod ?? pkg.devDependencies?.zod;
  if (!zod?.includes("4")) {
    problems.push(
      `${example}: uses zod ${String(zod)} but @flowpanel/kit peers on ${kit.peerDependencies.zod}`,
    );
  }
}

const eslintFactory = read("packages/eslint-plugin/src/create-rule.ts");
if (!eslintFactory.includes("/docs/reference/eslint-plugin#")) {
  problems.push(
    "packages/eslint-plugin/src/create-rule.ts: rule documentation URLs do not target the reference-page anchors",
  );
}

for (const file of walk("apps/site", (path) => /\.[jt]sx?$/.test(path))) {
  if (read(file).includes("next/font/google")) {
    problems.push(`${file}: downloads Google fonts during build; use a bundled font package`);
  }
}

const namedRelease = readdirSync(join(root, ".changeset"))
  .map((file) => ({ file, match: /^release-(\d+)-(\d+)-(\d+)\.md$/.exec(file) }))
  .find(({ match }) => match !== null);
if (namedRelease?.match) {
  const expectedVersion = namedRelease.match.slice(1).join(".");
  const releaseId = namedRelease.file.slice(0, -3);
  const tempDir = mkdtempSync(join(tmpdir(), "flowpanel-release-plan-"));
  const outputPath = join(tempDir, "status.json");
  try {
    execFileSync("pnpm", ["changeset", "status", "--output", outputPath], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    const status = JSON.parse(readFileSync(outputPath, "utf8"));
    const planned = status.releases.filter(
      (release) => release.name.startsWith("@flowpanel/") && release.changesets.includes(releaseId),
    );
    for (const release of planned) {
      if (release.newVersion !== expectedVersion) {
        problems.push(
          `${namedRelease.file}: plans ${release.name}@${release.newVersion}, expected ${expectedVersion}`,
        );
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} release consistency problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`✔ release consistency verified — ${publicTextFiles.length} public text files`);
