import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { createProgram } from "../../packages/cli/src/program";
import { buildCliReference } from "./cli-metadata";
import {
  README_COMPATIBILITY_END,
  README_COMPATIBILITY_START,
  renderReadmeCompatibility,
} from "./readme-compatibility";

function findWorkspaceRoot(start: string): string {
  let directory = resolve(start);
  const filesystemRoot = parse(directory).root;
  while (directory !== filesystemRoot) {
    if (existsSync(resolve(directory, "pnpm-workspace.yaml"))) return directory;
    directory = dirname(directory);
  }
  throw new Error(`Could not find pnpm-workspace.yaml above ${start}`);
}

const root = findWorkspaceRoot(process.cwd());
const output = resolve(root, "apps/site/src/generated/cli-reference.json");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(buildCliReference(createProgram()), null, 2)}\n`);

const readmePath = resolve(root, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(README_COMPATIBILITY_START);
const end = readme.indexOf(README_COMPATIBILITY_END);
if (start === -1 || end < start) {
  throw new Error("README compatibility markers are missing or out of order");
}
const compatibilityEnd = end + README_COMPATIBILITY_END.length;
writeFileSync(
  readmePath,
  `${readme.slice(0, start)}${renderReadmeCompatibility(root)}${readme.slice(compatibilityEnd)}`,
);
