import { describe, expect, it } from "vitest";
import { classifyCodeBlocks } from "../docs/check-snippets";

describe("documentation snippet classification", () => {
  it("checks a plain TypeScript fence and keeps its code without the indentation", () => {
    const result = classifyCodeBlocks(
      "# Example\n\n  ```ts\n  const value = 1;\n  ```\n",
      "page.mdx",
    );

    expect(result.problems).toEqual([]);
    expect(result.blocks).toEqual([
      { kind: "checked", language: "ts", line: 3, code: "const value = 1;\n" },
    ]);
  });

  it("rejects a fragment that does not say why it cannot compile", () => {
    const source = [
      "```ts fragment",
      "columns: [],",
      "```",
      "",
      "```ts fragment=snippet",
      "x",
      "```",
    ].join("\n");

    expect(classifyCodeBlocks(source, "page.mdx").problems).toEqual([
      expect.objectContaining({ code: "snippet-fragment-reason", file: "page.mdx", line: 1 }),
      expect.objectContaining({ code: "snippet-fragment-reason", file: "page.mdx", line: 5 }),
    ]);
  });

  it("knows which adapter tab a block sits in", () => {
    const source = [
      '<AdapterTab adapter="prisma">',
      "```ts",
      "const a = 1;",
      "```",
      "</AdapterTab>",
    ].join("\n");

    expect(classifyCodeBlocks(source, "page.mdx").blocks[0]?.adapter).toBe("prisma");
  });

  it("accepts checked code, fragments with a reason or a kind, and included files", () => {
    const source = [
      "```ts twoslash",
      "const checked = true;",
      "```",
      "",
      '```tsx fragment="one prop of the shell" title="shape only"',
      "<Shell brand={brand} />",
      "```",
      "",
      "```ts fragment=option",
      "columns: [],",
      "```",
      "",
      "<include>../snippets/config.ts</include>",
      "<include>../snippets/view.tsx</include>",
    ].join("\n");

    const result = classifyCodeBlocks(source, "page.mdx");

    expect(result.problems).toEqual([]);
    expect(result.blocks.map((block) => block.kind)).toEqual([
      "checked",
      "fragment",
      "fragment",
      "include",
      "include",
    ]);
    expect(result.blocks[1]?.reason).toBe("one prop of the shell");
  });

  it("reads the type an option is checked against and the module signatures must match", () => {
    const source = [
      "```ts as=\"ResourceOptions<RowOf<'runs'>>\"",
      "realtime: true,",
      "```",
      "",
      '```ts of="@flowpanel/kit/next"',
      "function buildNav(config: ResolvedAdminConfig): Promise<NavGroup[]>;",
      "```",
    ].join("\n");

    const [option, signature] = classifyCodeBlocks(source, "page.mdx").blocks;
    expect(option).toMatchObject({ kind: "checked", as: "ResourceOptions<RowOf<'runs'>>" });
    expect(signature).toMatchObject({ kind: "checked", of: "@flowpanel/kit/next" });
  });
});
