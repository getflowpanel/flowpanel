import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveProjectModule } from "../utils/module-path";

const CLOSED_STUB =
  /export\s+(?:async\s+)?function\s+getSession\s*\([^)]*\)[^{]*\{\s*return\s+null\s*;?\s*\}/;
const DEV_STUB_MARKER = /^\/\/\s*DEVELOPMENT STUB\b/m;
const GET_SESSION_IMPORT = /import\s*\{[^}]*\bgetSession\b[^}]*\}\s*from\s*["']([^"']+)["']/;

export interface SessionStub {
  /** Project-relative POSIX path of the module the config takes `getSession` from. */
  file: string;
  kind: "closed" | "development";
}

/** The module the config takes `getSession` from, when it is still one of the two stubs `init` writes. */
export async function findSessionStub(cwd: string): Promise<SessionStub | null> {
  const configFile = path.join(cwd, "flowpanel.config.ts");
  const config = await fs.readFile(configFile, "utf8").catch(() => null);
  const specifier = config === null ? undefined : GET_SESSION_IMPORT.exec(config)?.[1];
  if (!specifier) return null;
  const file = await resolveProjectModule(cwd, specifier, configFile);
  if (!file) return null;
  const source = await fs.readFile(file, "utf8").catch(() => "");
  const relative = path.relative(cwd, file).split(path.sep).join("/");
  if (CLOSED_STUB.test(source)) return { file: relative, kind: "closed" };
  return DEV_STUB_MARKER.test(source) ? { file: relative, kind: "development" } : null;
}
