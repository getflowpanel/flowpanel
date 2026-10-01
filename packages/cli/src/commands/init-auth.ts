import * as fs from "node:fs/promises";
import * as path from "node:path";
import { AUTH_PRESETS, type AuthProvider } from "../utils/auth-provider";
import { aliasOf, type PathAliasMode } from "../utils/detect";
import { resolveProjectModule, validateProjectImport } from "../utils/module-path";
import { tpl } from "../utils/template";

const SESSION_FILE = "server/lib/flowpanel-session.ts";

export interface AuthSessionPlan {
  provider: AuthProvider;
  /** Project-relative file the preset module is written to. */
  file: string;
  /** Import specifier the generated config uses for `getSession`. */
  specifier: string;
  template: string;
  vars: Record<string, string>;
}

export interface AuthSessionInput {
  cwd: string;
  provider: AuthProvider | null;
  /** What `detectAuth` found, already aliased. `null` when nothing matched. */
  detectedAuth: string | null;
  aliasMode: PathAliasMode;
  devAuth: boolean;
}

/** Bridges a provider's auth module through the matching preset when it exports an instance instead of `getSession`. */
export async function planAuthSession(input: AuthSessionInput): Promise<AuthSessionPlan | null> {
  const { detectedAuth, provider } = input;
  if (!provider || input.devAuth) return null;
  const { instance } = AUTH_PRESETS[provider];
  // `validateProjectImport` answers with the problem, so no problem means it exports that name.
  const exportsName = async (name: string): Promise<boolean> =>
    detectedAuth !== null && (await validateProjectImport(input.cwd, detectedAuth, name)) === null;

  if (await exportsName("getSession")) return null;
  if (instance !== null && !(await exportsName(instance))) return null;
  const file = input.aliasMode === "strip-src" ? `src/${SESSION_FILE}` : SESSION_FILE;
  return {
    provider,
    file,
    specifier: aliasOf(file, input.aliasMode),
    template: `auth-session.${provider}.ts.txt`,
    vars: instance === null ? {} : { AUTH_MODULE: detectedAuth as string },
  };
}

export type DevStubReplacement =
  | { kind: "replace"; file: string; content: string; expectedContent: string }
  | { kind: "customised"; file: string };

/** What `--dev-auth` does to the session module `specifier` already resolves to: swap an untouched stub, or refuse an edited file. */
export async function planDevStubReplacement(
  cwd: string,
  specifier: string,
): Promise<DevStubReplacement | null> {
  const resolved = await resolveProjectModule(cwd, specifier);
  if (!resolved) return null;
  const file = path.relative(cwd, resolved).split(path.sep).join("/");
  if (file.startsWith("../")) return { kind: "customised", file };
  const [current, closed, open] = await Promise.all([
    fs.readFile(resolved, "utf8"),
    tpl("auth-session.ts.txt"),
    tpl("dev-session.ts.txt"),
  ]);
  return current === closed || current === open
    ? { kind: "replace", file, content: open, expectedContent: closed }
    : { kind: "customised", file };
}
