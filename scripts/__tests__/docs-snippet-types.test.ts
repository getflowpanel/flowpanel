import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkDocBlocks, pageLine, strayPathComment, wrapped } from "../docs/check-snippet-types";

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("docs code block locations", () => {
  it("maps a wrapped option's first line back to the line under its fence", () => {
    const block = {
      kind: "checked" as const,
      language: "ts" as const,
      line: 10,
      code: "realtime: 1,\n",
      as: "AdminDefinition",
    };
    const { text, offset } = wrapped(block);
    expect(text.split("\n")[1]).toBe("realtime: 1,");
    expect(pageLine({ line: block.line, offset }, 1)).toBe(11);
  });

  it("flags a first-line path comment that says more than the path", () => {
    expect(strayPathComment("// src/realtime.ts, the publisher\nexport {};")).toBe(
      "// src/realtime.ts, the publisher",
    );
    expect(strayPathComment("// src/realtime.ts\nexport {};")).toBeNull();
    expect(strayPathComment("// the publisher\nexport {};")).toBeNull();
  });

  it("reports errors at the page line and leaves a file the reader creates without added imports", () => {
    const docs = mkdtempSync(join(tmpdir(), "fp-docs-lines-"));
    roots.push(docs);
    mkdirSync(join(docs, "guide"));
    writeFileSync(
      join(docs, "guide/page.mdx"),
      [
        "---",
        "title: Page",
        "---",
        "",
        '```ts as="AdminDefinition"',
        "readOnly: true,",
        'basePath: "/admin",',
        "```",
        "",
        "```ts",
        "// src/admin/broken.ts",
        'export const plan = enumOf({ free: "Free" });',
        "```",
        "",
      ].join("\n"),
    );
    const errors = checkDocBlocks(docs);
    expect(
      errors.some((error) => error.startsWith("apps/site/content/docs/guide/page.mdx:7:1 ")),
    ).toBe(true);
    expect(
      errors.some((error) =>
        error.startsWith("apps/site/content/docs/guide/page.mdx:12:21 TS2304"),
      ),
    ).toBe(true);
  }, 120_000);
});
