#!/usr/bin/env node
/**
 * Enforces the one-way import graph documented in README.md.
 *
 *     app → views → widgets → features → shared
 *
 * A file in layer X may import from any layer to its right, never to
 * its left. Cross-slice imports inside the same layer are also
 * forbidden (e.g. `views/landing` may not import `views/docs`).
 *
 * Runs from `apps/site/` via `pnpm boundaries`. Exits non-zero on the
 * first violation set so CI fails loudly.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE = `${path.dirname(fileURLToPath(import.meta.url))}/..`;

/** Layer order: leftmost imports the rest. */
const LAYERS = ["app", "views", "widgets", "features", "shared"];

/** Map a file path to its layer name, or null if outside the FSD graph. */
function layerOf(relPath) {
  if (relPath.startsWith("app/")) return "app";
  if (relPath.startsWith("src/views/")) return "views";
  if (relPath.startsWith("src/widgets/")) return "widgets";
  if (relPath.startsWith("src/features/")) return "features";
  if (relPath.startsWith("src/shared/")) return "shared";
  return null;
}

/** Top-level slice name within a layer (e.g. "landing" in views/landing/...). */
function sliceOf(relPath) {
  const parts = relPath.split("/");
  if (parts[0] === "src") return parts[2] ?? null;
  if (parts[0] === "app") return null;
  return null;
}

/** Map an alias import to {layer, slice}, or null if unknown. */
function resolveImport(spec) {
  if (!spec.startsWith("@/")) return null;
  const rest = spec.slice(2);
  if (rest.startsWith("views/")) return { layer: "views", slice: rest.split("/")[1] };
  if (rest.startsWith("widgets/")) return { layer: "widgets", slice: rest.split("/")[1] };
  if (rest.startsWith("features/")) return { layer: "features", slice: rest.split("/")[1] };
  if (rest.startsWith("shared/")) return { layer: "shared", slice: null };
  // @/.source/* — generated, ignore.
  if (rest.startsWith(".source")) return null;
  return null;
}

/** Walks a directory and yields .ts / .tsx files. */
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === ".source") continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(name)) {
      yield full;
    }
  }
}

const violations = [];
const importRe = /from\s+["']([^"']+)["']/g;

for (const file of walk(path.join(SITE, "src"))) {
  const rel = path.relative(SITE, file);
  const fileLayer = layerOf(rel);
  const fileSlice = sliceOf(rel);
  if (!fileLayer) continue;

  const src = readFileSync(file, "utf8");
  importRe.lastIndex = 0;
  for (const match of src.matchAll(importRe)) {
    const spec = match[1];
    const target = resolveImport(spec);
    if (!target) continue;

    // One-way layer rule.
    const fileIdx = LAYERS.indexOf(fileLayer);
    const targetIdx = LAYERS.indexOf(target.layer);
    if (targetIdx < fileIdx) {
      violations.push(
        `${rel}: imports ${spec} — ${fileLayer} cannot reach ${target.layer} (reverse direction)`,
      );
      continue;
    }

    // Cross-slice inside the same layer.
    if (fileLayer === target.layer && target.slice && fileSlice && target.slice !== fileSlice) {
      violations.push(
        `${rel}: imports ${spec} — cross-slice import inside ${fileLayer}/ (lift to a lower layer)`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("✖ Import-boundary violations:\n");
  for (const v of violations) console.error(`  ${v}`);
  console.error(`\n${violations.length} violation${violations.length === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log("✔ Import boundaries clean.");
