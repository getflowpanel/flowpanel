import { describe, expect, it } from "vitest";
import { classifyCodeBlocks } from "../docs/check-snippets";

describe("documentation snippet classification", () => {
  it("rejects an unclassified TypeScript fence with an actionable diagnostic", () => {
    const result = classifyCodeBlocks("# Example\n\n```ts\nconst value = 1;\n```\n", "page.mdx");

    expect(result.problems).toEqual([
      expect.objectContaining({
        code: "snippet-unclassified",
        file: "page.mdx",
        line: 3,
        suggestion: expect.stringMatching(/twoslash.*excerpt.*include/i),
      }),
    ]);
  });

  it("accepts checked, explanatory, and included TypeScript examples", () => {
    const source = [
      "```ts twoslash",
      "const checked = true;",
      "```",
      "",
      '```tsx excerpt title="shape only"',
      "export function Shape() { return null; }",
      "```",
      "",
      "<include>../snippets/config.ts</include>",
      "<include>../snippets/view.tsx</include>",
    ].join("\n");

    const result = classifyCodeBlocks(source, "page.mdx");

    expect(result.problems).toEqual([]);
    expect(result.blocks.map((block) => block.kind)).toEqual([
      "twoslash",
      "excerpt",
      "include",
      "include",
    ]);
  });
});
