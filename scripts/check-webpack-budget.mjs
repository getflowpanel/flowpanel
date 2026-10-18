import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

// The demo's admin under webpack (its own `build` script) loads at most this much JavaScript, gzip, on a list page.
// 0.4.0 launch, merged with launch-server: measured 230.5 KB (a browser loads about 241 KB with the parts a list hydrates); 447 KB before the kit kept its client modules apart under webpack.
const BUDGET_KB = 231;
const ROUTE = "/admin/[[...slug]]/page";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = path.join(root, "examples/ai-scraper");
const distArg = process.argv.find((arg) => arg.startsWith("--dist="));
const dist = path.join(demo, distArg ? distArg.slice("--dist=".length) : ".next");

if (!process.argv.includes("--no-build")) {
  execFileSync("pnpm", ["--filter", "ai-scraper", "build"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
}

const manifestFile = path.join(
  dist,
  "server/app/admin/[[...slug]]/page_client-reference-manifest.js",
);
if (!existsSync(manifestFile)) {
  console.error(
    `✗ ${path.relative(root, manifestFile)} is missing; build the demo with webpack first`,
  );
  process.exit(1);
}
const sandbox = {};
runInNewContext(readFileSync(manifestFile, "utf8"), sandbox);
const manifest = sandbox.__RSC_MANIFEST?.[ROUTE];
const build = JSON.parse(readFileSync(path.join(dist, "build-manifest.json"), "utf8"));
if (!manifest || !Array.isArray(build.rootMainFiles)) {
  console.error("✗ the webpack build manifests do not have the expected shape");
  process.exit(1);
}

const files = new Set(build.rootMainFiles);
for (const { chunks } of Object.values(manifest.clientModules)) {
  for (const [index, chunk] of chunks.entries()) if (index % 2 === 1) files.add(chunk);
}

let total = 0;
const sizes = [];
for (const file of files) {
  const text = readFileSync(path.join(dist, decodeURIComponent(file)), "utf8");
  const gzip = gzipSync(text).length;
  total += gzip;
  sizes.push({ file, gzip, recharts: text.includes("recharts") });
}
sizes.sort((a, b) => b.gzip - a.gzip);
const kb = (bytes) => (bytes / 1024).toFixed(1);
const charts = sizes.filter((size) => size.recharts);

console.log(
  `Admin first-load JavaScript under webpack: ${kb(total)} KB gzip in ${files.size} files (budget ${BUDGET_KB} KB)`,
);
for (const size of sizes.slice(0, 6))
  console.log(`  ${kb(size.gzip).padStart(6)} KB  ${size.file}`);
if (charts.length) {
  console.error(
    `✗ Recharts loads with every admin page: ${charts.map((size) => size.file).join(", ")}`,
  );
  process.exit(1);
}
if (total / 1024 > BUDGET_KB) {
  console.error(`✗ over budget by ${kb(total - BUDGET_KB * 1024)} KB`);
  process.exit(1);
}
console.log("✔ within budget");
