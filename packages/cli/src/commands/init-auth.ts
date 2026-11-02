import * as fs from "node:fs/promises";
import * as path from "node:path";
import { sessionModuleKind } from "../doctor/session-module";
import { AUTH_PRESETS, type AuthProvider } from "../utils/auth-provider";
import { aliasOf, type PathAliasMode } from "../utils/detect";
import { resolveProjectModule, validateProjectImport } from "../utils/module-path";
import { tpl } from "../utils/template";

const SESSION_BASENAME = "flowpanel-session.ts";
const SESSION_FILE = `server/lib/${SESSION_BASENAME}`;

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

/** The preset module beside the auth module it wraps, so it lands in the project's own layout. */
async function sessionFileNear(input: AuthSessionInput): Promise<string> {
  const auth = input.detectedAuth && (await resolveProjectModule(input.cwd, input.detectedAuth));
  if (auth) {
    const file = path.relative(input.cwd, path.join(path.dirname(auth), SESSION_BASENAME));
    if (!file.startsWith("..")) return file.split(path.sep).join("/");
  }
  return input.aliasMode === "strip-src" ? `src/${SESSION_FILE}` : SESSION_FILE;
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
  const file = await sessionFileNear(input);
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

/** The development stub, naming its own file so its warnings say which file to replace. */
export function devSessionStub(file: string): Promise<string> {
  return tpl("dev-session.ts.txt", { FILE: file });
}

/** What `--dev-auth` does to the session module `specifier` resolves to: swap one of init's stubs, or refuse the developer's own. */
export async function planDevStubReplacement(
  cwd: string,
  specifier: string,
): Promise<DevStubReplacement | null> {
  const resolved = await resolveProjectModule(cwd, specifier);
  if (!resolved) return null;
  const file = path.relative(cwd, resolved).split(path.sep).join("/");
  if (file.startsWith("../")) return { kind: "customised", file };
  const current = await fs.readFile(resolved, "utf8");
  if (sessionModuleKind(current) === "custom") return { kind: "customised", file };
  return { kind: "replace", file, content: await devSessionStub(file), expectedContent: current };
}

/** The `role` line of a generated config: the stubs' own session shape, or a guarded read of the developer's session. */
export function roleMapping(sessionSource: "stub" | "own"): string {
  if (sessionSource === "stub") return '    role: (s) => s?.user.role ?? "guest",';
  return [
    '    // Sessions without a string user.role count as "guest"; map your own roles here.',
    "    role: (s) => {",
    '      const user = s && "user" in s ? s.user : null;',
    '      return user && typeof user === "object" && "role" in user && typeof user.role === "string"',
    "        ? user.role",
    '        : "guest";',
    "    },",
  ].join("\n");
}
