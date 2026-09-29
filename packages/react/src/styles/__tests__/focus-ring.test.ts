import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("focus ring", () => {
  it("is at least 60% strong wherever it is the only focus mark", () => {
    const weak: string[] = [];
    for (const file of sources(resolve(process.cwd(), "src"))) {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        if (line.includes("border-fp-focus")) continue;
        for (const [, alpha] of line.matchAll(/ring-fp-focus\/(\d+)/g)) {
          if (Number(alpha) < 60) weak.push(`${file}: ring-fp-focus/${alpha}`);
        }
      }
    }
    expect(weak).toEqual([]);
  });
});
