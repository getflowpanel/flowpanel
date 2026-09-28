import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileExists } from "../utils/detect";
import { resolveProjectModule } from "../utils/module-path";

const REEXPORT = /^\s*export\s*\{\s*default\s*\}\s*from\s*["']([^"']+)["'];?\s*$/;

/** The module a config that is only `export { default } from "…"` forwards to, or `null`. */
export function reexportedFrom(source: string): string | null {
  return REEXPORT.exec(source)?.[1] ?? null;
}

export interface AdminConfigFile {
  /** The root `flowpanel.config.ts(x)`. */
  root: string;
  /** The file that holds the config: the root, or the module it re-exports. */
  file: string;
}

export async function findAdminConfig(cwd: string): Promise<AdminConfigFile | null> {
  for (const name of ["flowpanel.config.ts", "flowpanel.config.tsx"]) {
    const root = path.join(cwd, name);
    if (!(await fileExists(root))) continue;
    const spec = reexportedFrom(await fs.readFile(root, "utf8"));
    const target = spec === null ? null : await resolveProjectModule(cwd, spec, root);
    return { root, file: target ?? root };
  }
  return null;
}
