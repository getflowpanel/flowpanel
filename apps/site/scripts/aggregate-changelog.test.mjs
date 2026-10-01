import { describe, expect, it } from "vitest";
import { emit, escapeMdxProse } from "./aggregate-changelog.mjs";

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

describe("emit", () => {
  it("goes from the front matter straight to the newest version", () => {
    const body = emit(
      new Map([
        ["0.4.0", new Map([["@flowpanel/core", [{ section: "Changes", lines: ["- Added x."] }]]])],
        ["0.3.0", new Map([["@flowpanel/core", [{ section: "Changes", lines: ["- Added y."] }]]])],
      ]),
    );

    expect(body).not.toContain("<Callout");
    expect(body.indexOf("## v0.4.0")).toBeGreaterThan(body.indexOf("---\n\n"));
    expect(body.indexOf("## v0.4.0")).toBeLessThan(body.indexOf("## v0.3.0"));
  });
});
