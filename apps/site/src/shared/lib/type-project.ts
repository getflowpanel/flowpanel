import { resolve } from "node:path";
import { createGenerator, createProject } from "fumadocs-typescript";
import type { Project } from "ts-morph";

const SITE_ROOT = process.cwd();

type GeneratorProject = ReturnType<typeof createProject>;

let project: GeneratorProject | undefined;
let generator: ReturnType<typeof createGenerator> | undefined;

function getGeneratorProject(): GeneratorProject {
  project ??= createProject({ tsconfigPath: resolve(SITE_ROOT, "tsconfig.json") });
  return project;
}

export function getTypeProject(): Project {
  // fumadocs-typescript 4 currently declares ts-morph 27 while the workspace
  // uses 28. Both consumers share this exact runtime Project; keep the
  // compatibility cast at the dependency boundary instead of throughout docs.
  return getGeneratorProject() as unknown as Project;
}

export function getTypeGenerator(): ReturnType<typeof createGenerator> {
  generator ??= createGenerator({ project: getGeneratorProject(), cache: "fs" });
  return generator;
}
