import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { tpl } from "../../utils/template";

const kitPackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "../flowpanel/package.json"), "utf8"),
) as {
  exports: Record<string, string>;
  sideEffects: string[];
  peerDependencies: Record<string, string>;
};
const reactPackage = JSON.parse(
  readFileSync(resolve(process.cwd(), "../react/package.json"), "utf8"),
) as { peerDependencies: Record<string, string> };
const legacySource = readFileSync(resolve(process.cwd(), "../react/src/styles/admin.css"), "utf8");

describe("scaffolded stylesheet", () => {
  it("imports the package-built stylesheet without a Tailwind directive or source scan", async () => {
    for (const template of ["admin.css.txt", "admin.css.v3.txt"]) {
      const css = await tpl(template);
      expect(css).toContain('@import "@flowpanel/kit/styles/admin.css";');
      expect(css).not.toMatch(/^@(tailwind|source|theme)\b/m);
      expect(css).not.toContain('"tailwindcss');
    }
  });

  it("uses the kit's public CSS export, which package managers retain as a side effect", () => {
    expect(kitPackage.exports["./styles/admin.css"]).toBe("./dist/styles/admin.css");
    expect(kitPackage.sideEffects).toContain("**/*.css");
    expect(kitPackage.peerDependencies.tailwindcss).toBeUndefined();
    expect(reactPackage.peerDependencies.tailwindcss).toBeUndefined();
  });

  it("keeps the React source stylesheet as an explicit Tailwind compatibility path", () => {
    expect(legacySource).toContain("@theme inline {");
    expect(legacySource).toContain("--color-fp-bg-1:");
    expect(legacySource).toContain("--radius-fp:");
  });
});
