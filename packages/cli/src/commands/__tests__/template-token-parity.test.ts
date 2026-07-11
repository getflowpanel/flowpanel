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

describe("CLI templates track @flowpanel/react admin.css tokens", () => {
  for (const file of ["admin.css.txt", "admin.css.v3.txt"]) {
    it(`${file} declares every canonical --fp-* token with identical values`, () => {
      const tpl = tokens(readFileSync(join(__dirname, "../../templates", file), "utf8"));
      for (const [name, values] of tokens(canonical)) {
        expect(tpl.get(name), `${name} missing from ${file}`).toEqual(values);
      }
    });
  }
});
