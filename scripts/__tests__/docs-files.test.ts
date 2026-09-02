import { describe, expect, it } from "vitest";
import { docRoute, headingSlugs, lineAt, parseFrontmatter } from "../docs/files";

describe("documentation file helpers", () => {
  it("normalizes Windows routes and index pages", () => {
    expect(docRoute("C:\\repo\\docs\\guide\\index.mdx", "C:\\repo\\docs")).toBe("/docs/guide");
    expect(docRoute("C:\\repo\\docs\\guide\\start.mdx", "C:\\repo\\docs")).toBe(
      "/docs/guide/start",
    );
  });

  it("ignores fenced headings and suffixes duplicate slugs", () => {
    const headings = headingSlugs("# Start\n\n```md\n# Not a heading\n```\n\n## Start\n## Start\n");
    expect([...headings]).toEqual(["start", "start-1", "start-2"]);
  });

  it("parses frontmatter and stable line numbers", () => {
    const source = "---\ntitle: Hello\nkind: tutorial\n---\n\nBody\n";
    expect(parseFrontmatter(source)).toMatchObject({ data: { title: "Hello", kind: "tutorial" } });
    expect(lineAt(source, source.indexOf("Body"))).toBe(6);
  });
});
