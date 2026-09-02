import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles/admin.css"), "utf8");

describe("Flowpanel stylesheet boundary", () => {
  it("uses namespaced roots, variables and keyframes without host theme selectors", () => {
    expect(css).toContain("[data-flowpanel-root]");
    expect(css).toContain("@theme inline {");
    expect(css).not.toMatch(/@theme\s*\{/);
    expect(css).not.toMatch(/:root\s*\{/);
    expect(css).not.toMatch(/(^|\n)\.dark(?:\s|,|\{)/);
    expect(css).not.toMatch(/(^|\n)(?:html|body|\*)\s*\{/);

    for (const variable of css.matchAll(/--([\w-]+)\s*:/g)) {
      expect(variable[1]).toMatch(/(^|-)fp($|-)/);
    }
    for (const keyframe of css.matchAll(/@keyframes\s+([\w-]+)/g)) {
      expect(keyframe[1]).toMatch(/^fp-/);
    }
  });
});
