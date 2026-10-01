import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { noNextProject } from "../project-root";

let dir: string;

beforeEach(async () => {
  dir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "fp-root-")));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("noNextProject", () => {
  it("names the directory when there is no package.json", async () => {
    expect(await noNextProject(dir)).toBe(
      `No Next.js project found in ${dir}. Run this from your project root.`,
    );
  });

  it("rejects a package.json that has no next", async () => {
    await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ dependencies: {} }));
    expect(await noNextProject(dir)).toContain("No Next.js project found");
  });

  it("accepts a declared next, installed or not", async () => {
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ dependencies: { next: "16.3.4" } }),
    );
    expect(await noNextProject(dir)).toBeNull();
  });

  it("accepts a next that a workspace root provides", async () => {
    await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "root" }));
    await fs.mkdir(path.join(dir, "node_modules/next"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "node_modules/next/package.json"),
      JSON.stringify({ name: "next", version: "16.3.4" }),
    );
    const app = path.join(dir, "apps/web");
    await fs.mkdir(app, { recursive: true });
    await fs.writeFile(path.join(app, "package.json"), JSON.stringify({ name: "web" }));
    expect(await noNextProject(app)).toBeNull();
  });
});
