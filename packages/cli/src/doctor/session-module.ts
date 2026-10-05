import * as fs from "node:fs/promises";
import * as path from "node:path";
import { findAdminConfig } from "../scaffold/config-target";
import { resolveProjectModule } from "../utils/module-path";

const CLOSED_STUBS = [
  "type Session = { user: { id: string; role: string } }; export async function getSession(): Promise<Session | null> { return null; }",
  "type Session = { user: { id: string; role: string } }; export async function getSession(_req: Request): Promise<Session | null> { return null; }",
  "export async function getSession(_req: Request): Promise<null> { return null; }",
].map(normalized);
const DEV_STUB_MARKER = /^\s*(?:\/\/|\*)\s*DEVELOPMENT STUB\b/m;
const EXPORT = /\bexport\b/g;
const GET_SESSION_IMPORT = /import\s*\{[^}]*\bgetSession\b[^}]*\}\s*from\s*["']([^"']+)["']/;

export type SessionModuleKind = "closed" | "development" | "custom";

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function normalized(source: string): string {
  return withoutComments(source).replace(/[\s;,]+/g, "");
}

/** Which of `init`'s stubs a session module still is, or `"custom"` once the developer has changed it. */
export function sessionModuleKind(source: string): SessionModuleKind {
  if (CLOSED_STUBS.includes(normalized(source))) return "closed";
  const exports = withoutComments(source).match(EXPORT)?.length ?? 0;
  const onlyGetSession = exports === 1 && /\bexport\s+async\s+function\s+getSession\b/.test(source);
  return DEV_STUB_MARKER.test(source) && onlyGetSession ? "development" : "custom";
}

export interface SessionModule {
  /** Project-relative POSIX path of the module the config takes `getSession` from. */
  file: string;
  kind: SessionModuleKind;
}

export interface SessionStub extends SessionModule {
  kind: "closed" | "development";
}

/** The module the config takes `getSession` from, or `null` when the config has no such import. */
export async function findSessionModule(cwd: string): Promise<SessionModule | null> {
  const config = await findAdminConfig(cwd);
  if (!config) return null;
  const source = await fs.readFile(config.file, "utf8").catch(() => "");
  const specifier = GET_SESSION_IMPORT.exec(source)?.[1];
  if (!specifier) return null;
  const file = await resolveProjectModule(cwd, specifier, config.file);
  if (!file) return null;
  const body = await fs.readFile(file, "utf8").catch(() => "");
  return {
    file: path.relative(cwd, file).split(path.sep).join("/"),
    kind: sessionModuleKind(body),
  };
}

/** The config's session module, when it is still one of the two stubs `init` writes. */
export async function findSessionStub(cwd: string): Promise<SessionStub | null> {
  const found = await findSessionModule(cwd);
  return found && found.kind !== "custom" ? { file: found.file, kind: found.kind } : null;
}
