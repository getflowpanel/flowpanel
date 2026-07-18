import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const canonical = readFileSync(join(__dirname, "../../../../react/src/styles/admin.css"), "utf8");

function tokens(css: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of css.matchAll(/(--fp-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = m[1]!;
    const value = m[2]!;
    const list = out.get(name) ?? [];
    list.push(value.trim());
    out.set(name, list);
  }
  return out;
}

/**
 * Everything a template is expected to reproduce verbatim: the build-tool
 * preamble (`@import`/`@source`/`@tailwind`) and the v4-only `@theme` block
 * legitimately differ per flavour, comments are prose.
 */
function body(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^@(?:import|source|tailwind|charset)\b[^;]*;\s*$/gm, "")
    .replace(/^@theme\s*\{[\s\S]*?\n\}\s*$/gm, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

describe("CLI templates track @flowpanel/react admin.css tokens", () => {
  for (const file of ["admin.css.txt", "admin.css.v3.txt"]) {
    it(`${file} declares every canonical --fp-* token with identical values`, () => {
      const tpl = tokens(readFileSync(join(__dirname, "../../templates", file), "utf8"));
      for (const [name, values] of tokens(canonical)) {
        expect(tpl.get(name), `${name} missing from ${file}`).toEqual(values);
      }
    });

    it(`${file} reproduces every canonical rule outside the token block`, () => {
      const tpl = readFileSync(join(__dirname, "../../templates", file), "utf8");
      expect(body(tpl)).toEqual(body(canonical));
    });
  }
});
