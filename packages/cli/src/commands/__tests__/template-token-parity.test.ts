import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const canonical = readFileSync(resolve(process.cwd(), "../react/src/styles/admin.css"), "utf8");
const buildScript = readFileSync(
  resolve(process.cwd(), "../flowpanel/scripts/build-styles.mjs"),
  "utf8",
);

describe("precompiled stylesheet token contract", () => {
  it("maps each canonical @theme token family into the Tailwind 3 compiler configuration", () => {
    const themeNames = [
      ...canonical.matchAll(/--(?:color|radius|shadow|font|ease)-([\w-]+)\s*:/g),
    ].map(([, name]) => name);
    for (const name of themeNames) {
      expect(buildScript, `${name} is not represented in the precompiled token map`).toMatch(
        new RegExp(`(?:"${name}"|\\b${name}:)`),
      );
    }
  });

  it("does not duplicate token declarations in the generated app stylesheet", () => {
    for (const file of ["admin.css.txt", "admin.css.v3.txt"]) {
      const css = readFileSync(resolve(process.cwd(), "src/templates", file), "utf8");
      expect(css).toContain('@import "@flowpanel/kit/styles/admin.css";');
      expect(css).not.toContain("--fp-");
    }
  });
});
