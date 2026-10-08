import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The packed manifest carries no devDependencies: they only order the workspace build.
const manifest = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
const kept = `${manifest}.workspace`;

if (process.argv[2] === "strip") {
  const { devDependencies, ...published } = JSON.parse(readFileSync(manifest, "utf8"));
  renameSync(manifest, kept);
  writeFileSync(manifest, `${JSON.stringify(published, null, 2)}\n`);
} else if (process.argv[2] === "restore") {
  renameSync(kept, manifest);
} else {
  throw new Error("Usage: node scripts/pack-manifest.mjs strip|restore");
}
