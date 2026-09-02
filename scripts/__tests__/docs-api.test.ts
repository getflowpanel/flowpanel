import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkApi } from "../docs/check-api";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("documentation API checks", () => {
  it("checks imported names and generated component targets against TypeScript exports", () => {
    const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-api-check-"));
    fixtures.push(root);
    mkdirSync(join(root, "packages/example/src"), { recursive: true });
    mkdirSync(join(root, "apps/site/content/docs/reference"), { recursive: true });
    writeFileSync(
      join(root, "tsconfig.base.json"),
      JSON.stringify({ compilerOptions: { module: "ESNext", moduleResolution: "Bundler" } }),
    );
    writeFileSync(
      join(root, "packages/example/package.json"),
      JSON.stringify({
        name: "@fixture/example",
        exports: { ".": { types: "./dist/index.d.ts" } },
      }),
    );
    writeFileSync(
      join(root, "packages/example/src/index.ts"),
      'export { Known } from "./types";\n',
    );
    writeFileSync(
      join(root, "packages/example/src/types.ts"),
      "export interface Known { id: string }\n",
    );
    writeFileSync(
      join(root, "apps/site/content/docs/reference/api.mdx"),
      '---\ntitle: API\ndescription: API.\nkind: reference\n---\nimport { Known, Missing } from "@fixture/example";\n<AutoTypeTable path="../../packages/example/src/types.ts" name="Missing" />\n',
    );

    const codes = checkApi(root, { ownership: false, contracts: false }).map(
      (problem) => problem.code,
    );
    expect(codes).toEqual(expect.arrayContaining(["api-import-symbol", "api-component-symbol"]));
  });
});
