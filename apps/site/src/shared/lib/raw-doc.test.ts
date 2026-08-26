import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRawDocBody } from "./raw-doc";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("readRawDocBody", () => {
  it("expands canonical includes and renders build-only CLI metadata as text", async () => {
    const root = mkdtempSync(join(tmpdir(), "flowpanel-raw-doc-"));
    fixtures.push(root);
    const docs = join(root, "content/docs");
    const snippets = join(root, "content/snippets");
    mkdirSync(docs, { recursive: true });
    mkdirSync(snippets, { recursive: true });
    writeFileSync(join(snippets, "example.ts"), "export const checked = true;\n");
    writeFileSync(
      join(docs, "page.mdx"),
      '---\ntitle: Page\ndescription: Page.\nkind: reference\n---\n\n<include>../snippets/example.ts</include>\n\n<CliReference command="dev" />\n',
    );

    const body = await readRawDocBody(["page"], { contentRoot: docs });

    expect(body).toContain("export const checked = true;");
    expect(body).toContain("flowpanel dev");
    expect(body).not.toContain("<include>");
    expect(body).not.toContain("<CliReference");
  });
});
