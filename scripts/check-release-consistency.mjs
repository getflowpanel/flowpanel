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
    if (["node_modules", ".next", "dist", ".git", ".generated"].includes(entry)) continue;
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
const PUBLISHED = ["@flowpanel/cli", "@flowpanel/eslint-plugin", "@flowpanel/kit"];
const published = manifestFiles
  .filter((file) => file.startsWith("packages/"))
  .map((file) => JSON.parse(read(file)))
  .filter((manifest) => !manifest.private)
  .map((manifest) => manifest.name)
  .sort();
if (published.join() !== PUBLISHED.join()) {
  problems.push(
    `packages: publishes ${published.join(", ")}; expected only ${PUBLISHED.join(", ")}`,
  );
}
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  for (const name of Object.keys(kit[field] ?? {})) {
    if (name.startsWith("@flowpanel/")) {
      problems.push(
        `packages/flowpanel/package.json: ${field} names ${name}, which ships inside the kit`,
      );
    }
  }
}
for (const file of manifestFiles.filter((path) => /^(?:apps|examples)\//.test(path))) {
  const manifest = JSON.parse(read(file));
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    if (name.startsWith("@flowpanel/") && !PUBLISHED.includes(name)) {
      problems.push(`${file}: depends on ${name}, which ships inside @flowpanel/kit`);
    }
  }
}
const nextFloor = /(\d+\.\d+)/.exec(kit.peerDependencies.next)?.[1];
for (const file of [...publicTextFiles, "apps/site/src/views/landing/ui/GetStarted.tsx"]) {
  for (const match of read(file).matchAll(/Next\.js (\d+(?:\.\d+)?)\+/g)) {
    if (`${match[1]}${match[1]?.includes(".") ? "" : ".0"}` !== nextFloor) {
      problems.push(
        `${file}: says Next.js ${match[1]}+ but the package peer range is ${kit.peerDependencies.next}`,
      );
    }
  }
}
function resolveCatalog(name, specifier) {
  if (specifier !== "catalog:") return specifier;
  const key = name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`^ {2}"?${key}"?: "?([^"\\n]+)"?$`, "m").exec(read("pnpm-workspace.yaml"))?.[1];
}

for (const example of ["examples/ai-scraper/package.json", "examples/with-clerk/package.json"]) {
  const pkg = JSON.parse(read(example));
  const zod = resolveCatalog("zod", pkg.dependencies?.zod ?? pkg.devDependencies?.zod);
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

const versionedChangesets = readdirSync(join(root, ".changeset"))
  .map((file) => ({ file, match: /-(\d+)-(\d+)-(\d+)\.md$/.exec(file) }))
  .filter(({ match }) => match !== null);
if (versionedChangesets.length > 0) {
  const tempDir = mkdtempSync(join(tmpdir(), "flowpanel-release-plan-"));
  const outputPath = join(tempDir, "status.json");
  try {
    execFileSync("pnpm", ["changeset", "status", "--output", outputPath], {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    });
    const status = JSON.parse(readFileSync(outputPath, "utf8"));
    for (const { file, match } of versionedChangesets) {
      const expectedVersion = match.slice(1).join(".");
      const changesetId = file.slice(0, -3);
      const planned = status.releases.filter(
        (release) =>
          release.name.startsWith("@flowpanel/") && release.changesets.includes(changesetId),
      );
      if (planned.length === 0) problems.push(`${file}: plans no @flowpanel package release`);
      for (const release of planned) {
        if (release.newVersion !== expectedVersion) {
          problems.push(
            `${file}: plans ${release.name}@${release.newVersion}, expected ${expectedVersion}`,
          );
        }
      }
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

const coreDist = join(root, "packages/core/dist");
if (!existsSync(coreDist)) {
  problems.push("packages/core/dist: missing; run pnpm build before check:release");
} else {
  for (const file of readdirSync(coreDist, { recursive: true, encoding: "utf8" })) {
    if (!/\.d\.c?ts$/.test(file) || file.startsWith("index.")) continue;
    if (
      /\btype Session =|\binterface FlowpanelTypes\b/.test(
        readFileSync(join(coreDist, file), "utf8"),
      )
    ) {
      problems.push(
        `packages/core/dist/${file}: declares its own Session or FlowpanelTypes, which a host's registration cannot reach; import them from the core root`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} release consistency problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`✔ release consistency verified — ${publicTextFiles.length} public text files`);
