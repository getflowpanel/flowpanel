import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { detectPathAlias } from "../detect";
import { resolveProjectModule, validateProjectImport } from "../module-path";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "fp-module-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
async function write(file: string, content: string) {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), content);
}

it("resolves a custom alias to an index module without executing it", async () => {
  await write("tsconfig.json", '{"compilerOptions":{"baseUrl":".","paths":{"~/*":["src/*"]}}}');
  await write(
    "src/shared/lib/db/index.ts",
    'throw new Error("must not execute"); export const db = {};',
  );
  expect(await resolveProjectModule(root, "~/shared/lib/db")).toBe(
    path.join(root, "src/shared/lib/db/index.ts"),
  );
  expect(await validateProjectImport(root, "~/shared/lib/db", "db")).toBeNull();
});
it("reports a missing module and a missing named export separately", async () => {
  expect(await validateProjectImport(root, "./db", "db")).toContain("Cannot resolve");
  await write("db.ts", "export const connection = {};");
  expect(await validateProjectImport(root, "./db", "db")).toContain('export "db"');
});

it("resolves a named value through export-star barrels without executing them", async () => {
  await write("db/index.ts", 'export * from "./client";');
  await write("db/client.ts", 'throw new Error("must not execute"); export const db = {};');
  expect(await validateProjectImport(root, "./db", "db")).toBeNull();
  await write("db/client.ts", 'export * from "./index";');
  expect(await validateProjectImport(root, "./db", "db")).toContain('export "db"');
});

it("resolves aliases inside export-star barrels", async () => {
  await write("tsconfig.json", '{"compilerOptions":{"paths":{"@/*":["src/*"]}}}');
  await write("src/db/index.ts", 'export * from "@/db/client";');
  await write("src/db/client.ts", "export const db = {};");
  expect(await validateProjectImport(root, "@/db", "db")).toBeNull();
});
it("does not resolve bare guesses or source-injecting input", async () => {
  expect(await resolveProjectModule(root, 'db";alert(1)')).toBeNull();
  expect(await resolveProjectModule(root, "unknown-module")).toBeNull();
});

it("resolves inherited paths relative to their declaring config without executing code", async () => {
  await write(
    "configs/base.json",
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["../src/*"] } } }),
  );
  await write("tsconfig.json", JSON.stringify({ extends: "./configs/base.json" }));
  await write("src/db/index.ts", 'export * from "@/db/client";');
  await write("src/db/client.ts", 'throw new Error("never execute"); export const db = {};');
  expect(await detectPathAlias(root)).toBe("strip-src");
  expect(await validateProjectImport(root, "@/db", "db")).toBeNull();
});

it("uses an inherited baseUrl when the child overrides paths", async () => {
  await write("configs/base.json", JSON.stringify({ compilerOptions: { baseUrl: "../src" } }));
  await write(
    "tsconfig.json",
    JSON.stringify({
      extends: "./configs/base.json",
      compilerOptions: { paths: { "@/*": ["*"] } },
    }),
  );
  await write("src/db.ts", "export const db = {};");
  expect(await detectPathAlias(root)).toBe("strip-src");
  expect(await validateProjectImport(root, "@/db", "db")).toBeNull();
});

it("supports package-based extends and ordered multiple bases", async () => {
  await write(
    "node_modules/@fixture/tsconfig/package.json",
    '{"name":"@fixture/tsconfig","tsconfig":"base.json"}',
  );
  await write(
    "node_modules/@fixture/tsconfig/base.json",
    JSON.stringify({ compilerOptions: { baseUrl: "../../../", paths: { "@/*": ["wrong/*"] } } }),
  );
  await write(
    "override.json",
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["src/*"] } } }),
  );
  await write(
    "tsconfig.json",
    JSON.stringify({ extends: ["@fixture/tsconfig", "./override.json"] }),
  );
  await write("src/db.ts", "export const db = {};");
  expect(await validateProjectImport(root, "@/db", "db")).toBeNull();
});

it("does not use partial aliases when an extends chain is invalid or cyclic", async () => {
  await write("src/db.ts", "export const db = {};");
  await write(
    "tsconfig.json",
    JSON.stringify({ extends: "./missing.json", compilerOptions: { paths: { "@/*": ["src/*"] } } }),
  );
  expect(await resolveProjectModule(root, "@/db")).toBeNull();
  await write("missing.json", JSON.stringify({ extends: "./tsconfig.json" }));
  expect(await resolveProjectModule(root, "@/db")).toBeNull();
});
