import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, test } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = path.resolve(SRC, "../dist");

/** The four components `.size-limit.json` bills the UI budget against. */
const BUDGET_ENTRIES = [
  "_shell/AdminShell.tsx",
  "_data/DataTable.tsx",
  "_forms/AutoForm.tsx",
  "_forms/Form.tsx",
];

const SPECIFIERS = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;

function specifiersOf(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  return [...source.matchAll(SPECIFIERS)].map((m) => m[1] as string);
}

function resolveRelative(from: string, specifier: string): string | null {
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.mjs`,
    path.join(base, "index.tsx"),
    path.join(base, "index.ts"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every bare package name statically reachable from `entries`. */
function reachablePackages(entries: string[]): Set<string> {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith(".")) {
        const resolved = resolveRelative(file, specifier);
        if (resolved) queue.push(resolved);
        continue;
      }
      packages.add(
        specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier,
      );
    }
  }
  return packages;
}

describe("the UI budget graph", () => {
  it("never reaches cmdk from the four components size-limit measures", () => {
    const packages = reachablePackages(BUDGET_ENTRIES.map((entry) => path.join(SRC, entry)));
    expect(packages.has("cmdk")).toBe(false);
    // The dependency is still installed — the ⌘K palette is its one consumer.
    expect(reachablePackages([path.join(SRC, "_shell/CommandPalette.tsx")]).has("cmdk")).toBe(true);
  });

  const built = ["_forms/Form.mjs", "_forms/AutoForm.mjs", "_forms/field-controls.mjs"].map(
    (entry) => path.join(DIST, entry),
  );
  const builtCheck = built.every((entry) => fs.existsSync(entry)) ? it : test.skip;

  builtCheck("keeps cmdk out of the built modules a form pulls in (needs pnpm build)", () => {
    const entries = built;
    const seen = new Set<string>();
    const queue = [...entries];
    const sources: string[] = [];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      sources.push(fs.readFileSync(file, "utf8"));
      for (const specifier of specifiersOf(file)) {
        if (!specifier.startsWith(".")) continue;
        const resolved = resolveRelative(file, specifier);
        if (resolved) queue.push(resolved);
      }
    }
    expect(sources.join("\n")).not.toContain("cmdk");
  });
});
