// FlowPanel pre-commit chain.
//
// Stages, in order (per lint-staged run):
//   1. biome format --write — formatting on every supported file type.
//   2. biome check --write   — lints + safe fixes on TS/TSX.
//   3. tsc --noEmit          — per-package, only packages whose src/ files changed.
//   4. vitest related --run  — per-package, only for staged TS/TSX in packages/<pkg>/src/.
//
// Budget: <5s for typical small commits (1-3 files).
// Skip in emergencies with `git commit --no-verify` — CI will catch it.

import { relative } from "node:path";

const ROOT = process.cwd();

/**
 * From a list of absolute staged paths, extract the set of workspace package
 * names whose `src/` files actually changed.
 *
 * Example:  packages/core/src/foo.ts        → @flowpanel/core
 *           packages/adapter-bullmq/src/x.ts → @flowpanel/adapter-bullmq
 *           packages/flowpanel/src/x.ts      → flowpanel        (unscoped)
 */
function pkgsFromStagedFiles(files) {
  const pkgs = new Set();
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const m = rel.match(/^packages\/([^/]+)\/src\//);
    if (!m) continue;
    const dir = m[1];
    // packages/flowpanel is the meta-package "flowpanel" (unscoped);
    // every other packages/<dir> is published as @flowpanel/<dir>.
    pkgs.add(dir === "flowpanel" ? "flowpanel" : `@flowpanel/${dir}`);
  }
  return [...pkgs];
}

/**
 * Group staged absolute paths under packages/<dir>/src/ by their owning
 * workspace package name, returning relative paths for each.
 *
 * Mirrors {@link pkgsFromStagedFiles} so vitest can be run scoped to each
 * package's own config instead of from the monorepo root (where
 * `vitest related` resolves no project and `--passWithNoTests` would mask it).
 */
function relPathsByPkg(files) {
  const byPkg = new Map();
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const m = rel.match(/^packages\/([^/]+)\/src\//);
    if (!m) continue;
    const dir = m[1];
    const pkg = dir === "flowpanel" ? "flowpanel" : `@flowpanel/${dir}`;
    if (!byPkg.has(pkg)) byPkg.set(pkg, []);
    byPkg.get(pkg).push(rel);
  }
  return byPkg;
}

export default {
  // 1. Format every supported file.
  "*.{ts,tsx,js,mjs,cjs,json,jsonc,css}": ["biome format --write --no-errors-on-unmatched"],

  // 2. Lint + auto-fix TS/TSX.
  "*.{ts,tsx}": ["biome check --write --no-errors-on-unmatched"],

  // 3 + 4. Per-package typecheck + vitest related, only for files under packages/*/src.
  "packages/*/src/**/*.{ts,tsx}": (files) => {
    const cmds = [];
    for (const pkg of pkgsFromStagedFiles(files)) {
      cmds.push(`pnpm --filter ${pkg} typecheck`);
    }
    // Run `vitest related` scoped to each owning package so it resolves that
    // package's own vitest config. From the monorepo root vitest finds no
    // project and `--passWithNoTests` would silently mask the miss.
    // --run for CI/non-watch mode; --passWithNoTests because a staged file
    // may legitimately have no related test inside its package.
    for (const [pkg, relPaths] of relPathsByPkg(files)) {
      const paths = relPaths.join(" ");
      cmds.push(`pnpm --filter ${pkg} exec vitest related --run --passWithNoTests ${paths}`);
    }
    return cmds;
  },
};
