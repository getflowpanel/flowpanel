import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkContent } from "../docs/check-content";

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("documentation content checks", () => {
  it("returns actionable frontmatter, link, spelling, navigation, and snippet problems", () => {
    const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-content-"));
    fixtures.push(root);
    const docs = join(root, "apps/site/content/docs");
    mkdirSync(join(docs, "guide"), { recursive: true });
    writeFileSync(join(docs, "meta.json"), JSON.stringify({ title: "Docs", pages: ["guide"] }));
    writeFileSync(
      join(docs, "guide/meta.json"),
      JSON.stringify({ title: "Guide", pages: ["start"] }),
    );
    writeFileSync(
      join(docs, "guide/start.mdx"),
      "---\ntitle: Same\ndescription: Start here.\n---\n\nflowpanel turns config into UI.\n[Missing](/docs/missing)\n```ts fragment\nconst x = 1;\n```\n",
    );
    writeFileSync(
      join(docs, "guide/extra.mdx"),
      "---\ntitle: Same\ndescription: Extra.\nkind: how-to\n---\n",
    );
    writeFileSync(join(root, "README.md"), "[Broken](./missing.md)\n");

    const codes = checkContent(root).map((problem) => problem.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "frontmatter-kind",
        "link-page-missing",
        "product-spelling",
        "navigation-missing",
        "title-duplicate",
        "snippet-fragment-reason",
        "readme-link-missing",
      ]),
    );
  });

  it("accepts a page that another group lists by relative path", () => {
    const root = mkdtempSync(join(tmpdir(), "flowpanel-docs-borrowed-"));
    fixtures.push(root);
    const docs = join(root, "apps/site/content/docs");
    mkdirSync(join(docs, "intro"), { recursive: true });
    mkdirSync(join(docs, "guides"), { recursive: true });
    writeFileSync(
      join(docs, "meta.json"),
      JSON.stringify({ title: "Docs", pages: ["intro", "guides"] }),
    );
    writeFileSync(
      join(docs, "intro/meta.json"),
      JSON.stringify({ title: "Intro", pages: ["start", "../guides/upgrade"] }),
    );
    writeFileSync(join(docs, "guides/meta.json"), JSON.stringify({ title: "Guides", pages: [] }));
    writeFileSync(
      join(docs, "intro/start.mdx"),
      "---\ntitle: Start\ndescription: Start here.\nkind: tutorial\n---\n",
    );
    writeFileSync(
      join(docs, "guides/upgrade.mdx"),
      "---\ntitle: Upgrade\ndescription: Upgrade.\nkind: how-to\n---\n",
    );

    const codes = checkContent(root).map((problem) => problem.code);

    expect(codes).not.toContain("navigation-missing");
  });
});
