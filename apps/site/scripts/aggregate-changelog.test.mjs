import { describe, expect, it } from "vitest";
import { escapeMdxProse } from "./aggregate-changelog.mjs";

describe("escapeMdxProse", () => {
  it("escapes the characters MDX would read as syntax", () => {
    expect(escapeMdxProse("pass { version: 2 } through")).toBe("pass \\{ version: 2 } through");
    expect(escapeMdxProse("compare a < b")).toBe("compare a \\< b");
  });

  it("leaves inline code spans alone", () => {
    expect(escapeMdxProse("the `{ version: 2 }` literal")).toBe("the `{ version: 2 }` literal");
    expect(escapeMdxProse("``a ` { b``")).toBe("``a ` { b``");
  });

  it("leaves fenced blocks alone", () => {
    const fenced = ["```ts", "const a = { b: 1 };", "```", "and { after }"].join("\n");
    expect(escapeMdxProse(fenced)).toBe(
      ["```ts", "const a = { b: 1 };", "```", "and \\{ after }"].join("\n"),
    );
  });

  it("escapes a lazy line that would otherwise open an expression mid-list", () => {
    const note = ["- the `capabilities:", "{ version: 2 }` literal"].join("\n");
    expect(escapeMdxProse(note)).toBe(
      ["- the `capabilities:", "\\{ version: 2 }` literal"].join("\n"),
    );
  });
});
