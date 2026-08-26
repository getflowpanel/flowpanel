import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectPublicSymbols } from "../docs/public-api";

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-api-"));
  fixtures.push(root);
  const pkg = join(root, "packages/example");
  mkdirSync(join(pkg, "src"), { recursive: true });

  writeFileSync(
    join(root, "tsconfig.base.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        module: "ESNext",
        moduleResolution: "Bundler",
        paths: { "@fixture/built": ["packages/example/dist/external.d.ts"] },
      },
    }),
  );
  writeFileSync(
    join(pkg, "package.json"),
    JSON.stringify({
      name: "@fixture/example",
      type: "module",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./react": { types: "./dist/react.d.ts", import: "./dist/react.js" },
        "./umbrella": { types: "./dist/umbrella.d.ts", import: "./dist/umbrella.js" },
        "./package.json": "./package.json",
      },
    }),
  );
  writeFileSync(
    join(pkg, "src/index.ts"),
    [
      'export { createThing as makeThing, type ThingOptions } from "./thing";',
      'export * from "./version";',
    ].join("\n"),
  );
  writeFileSync(
    join(pkg, "src/thing.ts"),
    [
      "export interface ThingOptions { label: string }",
      "export function createThing(options: ThingOptions): string { return options.label; }",
      'export const privateThing = "not public";',
    ].join("\n"),
  );
  writeFileSync(join(pkg, "src/version.ts"), 'export const version = "1.0.0";\n');
  writeFileSync(join(pkg, "src/react.ts"), 'export { ThingView } from "./view";\n');
  mkdirSync(join(pkg, "dist"), { recursive: true });
  writeFileSync(join(pkg, "dist/external.d.ts"), "export declare function builtThing(): string;\n");
  writeFileSync(
    join(pkg, "src/external.ts"),
    'export function builtThing(): string { return "built"; }\n',
  );
  writeFileSync(join(pkg, "src/umbrella.ts"), 'export * from "@fixture/built";\n');
  writeFileSync(
    join(pkg, "src/view.ts"),
    'export function ThingView(): string { return "view"; }\n',
  );

  return root;
}

describe("collectPublicSymbols", () => {
  it("follows aliases, star exports, type exports, and package subpaths", () => {
    const root = createFixture();

    const symbols = collectPublicSymbols(root);

    expect(
      symbols.map((symbol) => ({
        exportPath: symbol.exportPath,
        exportName: symbol.exportName,
        kind: symbol.kind,
        declarationPath: symbol.declarationPath,
        isTypeOnly: symbol.isTypeOnly,
      })),
    ).toEqual([
      {
        exportPath: ".",
        exportName: "ThingOptions",
        kind: "interface",
        declarationPath: "packages/example/src/thing.ts",
        isTypeOnly: true,
      },
      {
        exportPath: ".",
        exportName: "makeThing",
        kind: "function",
        declarationPath: "packages/example/src/thing.ts",
        isTypeOnly: false,
      },
      {
        exportPath: ".",
        exportName: "version",
        kind: "const",
        declarationPath: "packages/example/src/version.ts",
        isTypeOnly: false,
      },
      {
        exportPath: "./react",
        exportName: "ThingView",
        kind: "function",
        declarationPath: "packages/example/src/view.ts",
        isTypeOnly: false,
      },
      {
        exportPath: "./umbrella",
        exportName: "builtThing",
        kind: "function",
        declarationPath: "packages/example/src/external.ts",
        isTypeOnly: false,
      },
    ]);
  });

  it("discovers the current workspace public surface", () => {
    const root = join(import.meta.dirname, "../..");

    const symbols = collectPublicSymbols(root);

    expect(symbols.length).toBeGreaterThanOrEqual(400);
    expect(
      symbols.every(
        (symbol) =>
          !symbol.declarationPath.startsWith("packages/") ||
          !symbol.declarationPath.includes("/dist/"),
      ),
    ).toBe(true);
  }, 20_000);
});
