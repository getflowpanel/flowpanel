import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PACKAGES = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const INTERNAL = [
  "core",
  "next",
  "react",
  "charts",
  "client",
  "adapter-drizzle",
  "adapter-prisma",
  "adapter-bullmq",
  "test",
];

interface Manifest {
  exports: Record<string, unknown>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const read = (directory: string): Manifest =>
  JSON.parse(readFileSync(path.join(PACKAGES, directory, "package.json"), "utf8"));

describe("the kit's manifest", () => {
  const kit = read("flowpanel");

  it("depends on exactly the internal packages' third-party dependencies, at their ranges", () => {
    const union: Record<string, string> = {};
    for (const directory of INTERNAL) {
      for (const [name, range] of Object.entries(read(directory).dependencies ?? {})) {
        if (name.startsWith("@flowpanel/")) continue;
        expect(union[name] ?? range, `${name} in packages/${directory}`).toBe(range);
        union[name] = range;
      }
    }
    expect(kit.dependencies).toEqual(union);
  });

  it("names no @flowpanel package it ships", () => {
    const named = Object.keys({ ...kit.dependencies, ...kit.peerDependencies });
    expect(named.filter((name) => name.startsWith("@flowpanel/"))).toEqual([]);
  });

  it("builds each code subpath from a src entry of the same name", () => {
    for (const [subpath, entry] of Object.entries(kit.exports)) {
      if (subpath.endsWith(".css") || subpath === "./package.json") continue;
      const target = JSON.stringify(entry).match(/"\.\/dist\/([\w-]+)\.js"/)?.[1];
      expect(target, subpath).toBeDefined();
      expect(() =>
        readFileSync(path.join(PACKAGES, "flowpanel/src", `${target}.ts`)),
      ).not.toThrow();
    }
  });
});
