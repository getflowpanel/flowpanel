import { readFileSync } from "node:fs";

/**
 * Docs pages read repository sources — package manifests, TypeScript entry points,
 * MDX includes — none of which ship in the deployed image. Rendering them at build
 * time is the contract; a page that slips into on-demand rendering passes every
 * check and then 500s in production.
 */
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
