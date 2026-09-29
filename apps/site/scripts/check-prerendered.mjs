import { readFileSync } from "node:fs";

// Docs pages read repository sources the image lacks, so each must prerender or it 500s in production.
const REQUIRED = [
  "/docs/introduction/getting-started",
  "/api/md/docs/introduction/getting-started",
  "/llms-full.txt",
  "/",
];

const manifest = JSON.parse(
  readFileSync(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8"),
);
const routes = manifest.routes ?? {};
const missing = REQUIRED.filter((route) => !(route in routes));

if (missing.length > 0) {
  console.error(`✗ rendered on demand: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`✓ ${Object.keys(routes).length} routes prerendered`);
