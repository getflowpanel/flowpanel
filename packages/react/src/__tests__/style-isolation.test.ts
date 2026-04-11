import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("Style isolation", () => {
  const distPath = resolve(__dirname, "../../dist/styles.css");

  it("dist/styles.css exists", () => {
    expect(existsSync(distPath)).toBe(true);
  });

  it("CSS variables scoped under .flowpanel, not :root", () => {
    const css = readFileSync(distPath, "utf-8");
    expect(css).toContain(".flowpanel");
    // Should not set --background on :root
    expect(css).not.toMatch(/:root\s*\{[^}]*--background/);
  });
});
