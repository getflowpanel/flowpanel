import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
// @ts-expect-error Build tooling is executed as JavaScript and deliberately has no public types.
import * as vendor from "../../scripts/vendor.mjs";

const { directivePrologue, onlyReexports, rewriteFile, sourceModules, specifiers } = vendor;

const dist = mkdtempSync(join(tmpdir(), "fp-vendor-"));
afterAll(() => rmSync(dist, { recursive: true, force: true }));

for (const file of [
  "core/index.mjs",
  "core/index.d.ts",
  "core/labels.mjs",
  "core/labels.d.ts",
  "charts/runtime.js",
  "charts/runtime.d.ts",
]) {
  mkdirSync(dirname(join(dist, file)), { recursive: true });
  writeFileSync(join(dist, file), "");
}

const shipped = (directory: string) => (target: string) =>
  target.startsWith("./dist/") ? join(dist, directory, target.slice(7)) : null;

const packages = new Map([
  [
    "@flowpanel/core",
    {
      exports: {
        ".": { import: { types: "./dist/index.d.ts", default: "./dist/index.mjs" } },
        "./labels": { import: { types: "./dist/labels.d.ts", default: "./dist/labels.mjs" } },
      },
      distOf: shipped("core"),
    },
  ],
  [
    "@flowpanel/charts",
    {
      exports: { "./runtime": { types: "./dist/runtime.d.ts", import: "./dist/runtime.js" } },
      distOf: shipped("charts"),
    },
  ],
]);

describe("vendoring the internal packages into the kit", () => {
  it("reads module specifiers, not strings that look like them", () => {
    const text = [
      'import { a } from "@flowpanel/core";',
      'const range = [params.get("from"), params.get("to")];',
      'const hint = "import * as schema from \\"./schema\\"";',
      'await import("@flowpanel/charts/runtime");',
    ].join("\n");
    expect(specifiers(text).map(({ name }: { name: string }) => name)).toEqual([
      "@flowpanel/core",
      "@flowpanel/charts/runtime",
    ]);
  });

  it("points JavaScript at the import target and declarations at the types target", () => {
    const js = rewriteFile(
      'export * from "@flowpanel/core/labels";\nawait import("@flowpanel/charts/runtime");\nimport "react";',
      join(dist, "next/index.js"),
      packages,
    );
    expect(js.errors).toEqual([]);
    expect(js.output).toBe(
      'export * from "../core/labels.mjs";\nawait import("../charts/runtime.js");\nimport "react";',
    );

    const types = rewriteFile(
      'import { A } from "@flowpanel/core";\ndeclare module "@flowpanel/core" {\n  interface Slots {}\n}',
      join(dist, "react/provider/Context.d.ts"),
      packages,
    );
    expect(types.errors).toEqual([]);
    expect(types.output).toBe(
      'import { A } from "../../core/index.js";\ndeclare module "../../core/index.js" {\n  interface Slots {}\n}',
    );
  });

  it("names the file and the specifier it cannot resolve", () => {
    const { errors } = rewriteFile(
      'import "@flowpanel/core/missing";\nimport "@flowpanel/nope";',
      join(dist, "react/index.mjs"),
      packages,
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('"@flowpanel/nope"');
    expect(errors[1]).toContain(
      '"@flowpanel/core/missing" is not in the exports of @flowpanel/core',
    );
  });

  it("keeps a module's directives as the prologue", () => {
    const text = '"use client";\n"use client";\nimport { x } from "../core/index.mjs";\n';
    expect(directivePrologue(text)).toBe('"use client";\n"use client";');
  });

  it("accepts an entry that only re-exports, and refuses a side-effect import", () => {
    expect(onlyReexports('export * from "@flowpanel/core/auth";\n')).toBe(true);
    expect(onlyReexports('export * from "./core/auth.js";\nimport "./test/index.js";\n')).toBe(
      false,
    );
    expect(onlyReexports("export const x = 1;\n")).toBe(false);
  });

  it("reads the source modules esbuild bundled into a file", () => {
    const text = '"use client";\n\n// src/a.ts\nvar a = 1;\n\n// src/b/c.tsx\nvar c = 2;\n';
    expect(sourceModules(text, "core")).toEqual(["core/src/a.ts", "core/src/b/c.tsx"]);
  });
});
